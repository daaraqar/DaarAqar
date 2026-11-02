import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { dbStore } from "@/lib/db/store";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    if (!isSupabaseDirect()) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "خدمة سجل الزوار غير متاحة حالياً" }, { status: 503 });
      }

      const visitors = dbStore
        .getAuditEvents()
        .filter((event) => event.action === "VISITOR_PROPERTY_CONTACT_CAPTURED")
        .map((event) => ({
          id: event.id,
          ...(event.details as Record<string, unknown>),
          createdAt: event.timestamp,
        }));
      return NextResponse.json({ visitors });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("audit_events")
      .select("id, details, created_at")
      .eq("action", "VISITOR_PROPERTY_CONTACT_CAPTURED")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to fetch property visitor contacts:", error);
      return NextResponse.json({ error: "تعذر تحميل سجل الزوار" }, { status: 500 });
    }

    const visitors = (data || []).map((event) => ({
      id: event.id,
      ...(event.details as Record<string, unknown>),
      createdAt: event.created_at,
    }));
    return NextResponse.json({ visitors });
  } catch (error: unknown) {
    console.error("Failed to load property visitor log:", error);
    const message = error instanceof Error ? error.message : "تعذر تحميل سجل الزوار";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
