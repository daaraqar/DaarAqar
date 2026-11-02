import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type ServiceInquiryStatus = "new" | "contacted" | "converted" | "closed";

interface ServiceInquiry {
  id: string;
  serviceId: string;
  serviceName: string;
  name: string;
  phone: string;
  notes: string;
  status: ServiceInquiryStatus;
  createdAt: string;
}

const validStatuses: ServiceInquiryStatus[] = ["new", "contacted", "converted", "closed"];

function mapEvents(events: Array<{
  id: string;
  action: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}>): ServiceInquiry[] {
  const inquiries = new Map<string, ServiceInquiry>();

  for (const event of [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )) {
    const details = event.details || {};
    if (event.action === "SERVICE_INQUIRY_CREATED") {
      inquiries.set(event.entity_id, {
        id: event.entity_id,
        serviceId: typeof details.serviceId === "string" ? details.serviceId : "",
        serviceName: typeof details.serviceName === "string" ? details.serviceName : "خدمة عقارية",
        name: typeof details.name === "string" ? details.name : "",
        phone: typeof details.phone === "string" ? details.phone : "",
        notes: typeof details.notes === "string" ? details.notes : "",
        status: "new",
        createdAt: event.created_at,
      });
    } else if (event.action === "SERVICE_INQUIRY_STATUS_UPDATED") {
      const existing = inquiries.get(event.entity_id);
      if (existing && typeof details.status === "string" && validStatuses.includes(details.status as ServiceInquiryStatus)) {
        existing.status = details.status as ServiceInquiryStatus;
      }
    }
  }

  return Array.from(inquiries.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول لعرض طلبات الخدمات" }, { status: 401 });
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح بعرض طلبات الخدمات" }, { status: 403 });
    }

    if (!isSupabaseDirect() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "خدمة طلبات الخدمات غير متاحة حالياً" }, { status: 503 });
      }
      const events = dbStore.getAuditEvents(500)
        .filter((event) => event.action === "SERVICE_INQUIRY_CREATED" || event.action === "SERVICE_INQUIRY_STATUS_UPDATED")
        .map((event) => ({
          id: event.id,
          action: event.action,
          entity_id: event.entityId,
          details: event.details,
          created_at: event.timestamp,
        }));
      return NextResponse.json({ inquiries: mapEvents(events) });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("audit_events")
      .select("id, action, entity_id, details, created_at")
      .in("action", ["SERVICE_INQUIRY_CREATED", "SERVICE_INQUIRY_STATUS_UPDATED"])
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      console.error("[admin/service-inquiries] Failed to load service inquiries:", error);
      return NextResponse.json({ error: "تعذر تحميل طلبات الخدمات" }, { status: 500 });
    }

    return NextResponse.json({ inquiries: mapEvents(data || []) });
  } catch (error: unknown) {
    console.error("[admin/service-inquiries] Failed to load service inquiries:", error);
    return NextResponse.json({ error: "تعذر تحميل طلبات الخدمات" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول لتحديث طلبات الخدمات" }, { status: 401 });
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح بتحديث طلبات الخدمات" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "بيانات التحديث غير صالحة" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات التحديث غير صالحة" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const inquiryId = typeof payload.inquiryId === "string" ? payload.inquiryId.trim() : "";
    const status = payload.status;
    if (!inquiryId || inquiryId.length > 80 || typeof status !== "string" || !validStatuses.includes(status as ServiceInquiryStatus)) {
      return NextResponse.json({ error: "معرف الطلب أو حالته غير صالحة" }, { status: 400 });
    }

    const details = { status };
    if (!isSupabaseDirect() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "خدمة طلبات الخدمات غير متاحة حالياً" }, { status: 503 });
      }
      const exists = dbStore.getAuditEvents(500).some(
        (event) => event.action === "SERVICE_INQUIRY_CREATED" && event.entityId === inquiryId
      );
      if (!exists) return NextResponse.json({ error: "لم يتم العثور على الطلب" }, { status: 404 });
      dbStore.recordAuditEvent(user.id, "SERVICE_INQUIRY_STATUS_UPDATED", "service_inquiry", inquiryId, details);
      return NextResponse.json({ success: true });
    }

    const supabaseAdmin = createAdminClient();
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("audit_events")
      .select("id")
      .eq("action", "SERVICE_INQUIRY_CREATED")
      .eq("entity_id", inquiryId)
      .maybeSingle();
    if (lookupError) {
      console.error("[admin/service-inquiries] Failed to validate service inquiry:", lookupError);
      return NextResponse.json({ error: "تعذر التحقق من الطلب" }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "لم يتم العثور على الطلب" }, { status: 404 });

    const { error } = await supabaseAdmin.from("audit_events").insert({
      user_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) ? user.id : null,
      action: "SERVICE_INQUIRY_STATUS_UPDATED",
      entity_type: "service_inquiry",
      entity_id: inquiryId,
      details,
    });
    if (error) {
      console.error("[admin/service-inquiries] Failed to update service inquiry:", error);
      return NextResponse.json({ error: "تعذر تحديث حالة الطلب" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[admin/service-inquiries] Failed to update service inquiry:", error);
    return NextResponse.json({ error: "تعذر تحديث حالة الطلب" }, { status: 500 });
  }
}
