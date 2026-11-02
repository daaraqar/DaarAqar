import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, isValidPhone, normalizeEgyptianPhone } from "@/lib/auth/security";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const serviceLabels: Record<string, string> = {
  "aqar-plus": "عقار+",
  promo: "خدمات الترويج والتسويق",
  inspection: "فحص وتقييم المباني",
  contracts: "عقود الإيجار والتوثيق الإلكتروني",
  "mortgage-calc": "حاسبة التمويل العقاري",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    if (typeof payload.website === "string" && payload.website.trim()) {
      return NextResponse.json({ error: "تعذر التحقق من الطلب" }, { status: 400 });
    }

    const serviceId = typeof payload.serviceId === "string" ? payload.serviceId : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const rawPhone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    if (payload.notes !== undefined && typeof payload.notes !== "string") {
      return NextResponse.json({ error: "صيغة الملاحظات غير صالحة" }, { status: 400 });
    }
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

    if (!serviceLabels[serviceId]) {
      return NextResponse.json({ error: "الخدمة المحددة غير متاحة" }, { status: 400 });
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "يرجى إدخال اسم صحيح لا يتجاوز 100 حرف" }, { status: 400 });
    }
    if (!isValidPhone(rawPhone)) {
      return NextResponse.json({ error: "يرجى إدخال رقم هاتف صحيح" }, { status: 400 });
    }
    if (notes.length > 500) {
      return NextResponse.json({ error: "يجب ألا تتجاوز الملاحظات 500 حرف" }, { status: 400 });
    }
    if (payload.consent !== true) {
      return NextResponse.json({ error: "يرجى الموافقة على التواصل بخصوص هذا الطلب" }, { status: 400 });
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown_client";
    const ipRate = checkRateLimit(`service_inquiry_ip_${clientIp}`, 5, 30 * 60 * 1000);
    if (!ipRate.allowed) {
      return NextResponse.json(
        { error: "تم تجاوز عدد المحاولات. يرجى الانتظار قبل المحاولة مجدداً." },
        { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } }
      );
    }

    const phone = normalizeEgyptianPhone(rawPhone);
    const phoneRate = checkRateLimit(`service_inquiry_phone_${phone}`, 3, 60 * 60 * 1000);
    if (!phoneRate.allowed) {
      return NextResponse.json(
        { error: "تم تسجيل طلبات متعددة بهذا الرقم. يرجى المحاولة لاحقاً." },
        { status: 429, headers: { "Retry-After": String(phoneRate.retryAfterSeconds) } }
      );
    }

    const user = await getCurrentUser(request);
    const inquiryId = randomUUID();
    const details = {
      serviceId,
      serviceName: serviceLabels[serviceId],
      name,
      phone,
      notes,
      status: "new",
      submittedAt: new Date().toISOString(),
    };

    if (isSupabaseDirect() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createAdminClient();
      const userId = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
        ? user.id
        : null;
      const { error } = await supabaseAdmin.from("audit_events").insert({
        user_id: userId,
        action: "SERVICE_INQUIRY_CREATED",
        entity_type: "service_inquiry",
        entity_id: inquiryId,
        details,
      });
      if (error) {
        console.error("[service-inquiries] Failed to save service inquiry:", error);
        return NextResponse.json({ error: "تعذر حفظ طلبك. يرجى المحاولة مرة أخرى." }, { status: 500 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "خدمة طلبات الخدمات غير متاحة حالياً" }, { status: 503 });
    } else {
      dbStore.recordAuditEvent(
        user?.id,
        "SERVICE_INQUIRY_CREATED",
        "service_inquiry",
        inquiryId,
        details
      );
    }

    return NextResponse.json(
      { success: true, inquiryId, message: "تم تسجيل طلبك، وسيتواصل معك فريق الدعم لمناقشة التفاصيل والتكلفة." },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[service-inquiries] Failed to create service inquiry:", error);
    return NextResponse.json({ error: "تعذر تسجيل الطلب حالياً. يرجى المحاولة مرة أخرى." }, { status: 500 });
  }
}
