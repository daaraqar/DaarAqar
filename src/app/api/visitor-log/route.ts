import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, isValidPhone, normalizeEgyptianPhone } from "@/lib/auth/security";
import { dbStore } from "@/lib/db/store";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

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
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    if (!category || category.length > 80) {
      return NextResponse.json({ error: "نوع العقار غير صالح" }, { status: 400 });
    }
    if (payload.transactionType !== "sale" && payload.transactionType !== "rent") {
      return NextResponse.json({ error: "نوع المعاملة غير صالح" }, { status: 400 });
    }
    if (typeof payload.isProject !== "boolean") {
      return NextResponse.json({ error: "نوع الإعلان غير صالح" }, { status: 400 });
    }

    const transactionType = payload.transactionType;
    const isProject = payload.isProject;

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "يرجى إدخال اسم صحيح لا يتجاوز 100 حرف" }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "يرجى إدخال رقم هاتف صحيح" }, { status: 400 });
    }
    if (!title || title.length > 200) {
      return NextResponse.json({ error: "عنوان العقار مطلوب ويجب ألا يتجاوز 200 حرف" }, { status: 400 });
    }

    const normalizedPhone = normalizeEgyptianPhone(phone);
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown_client";
    const ipRate = checkRateLimit(`visitor_log_ip_${clientIp}`, 6, 10 * 60 * 1000);
    if (!ipRate.allowed) {
      return NextResponse.json(
        { error: "تم تجاوز عدد المحاولات. يرجى الانتظار قبل المحاولة مجدداً." },
        { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } }
      );
    }
    const phoneRate = checkRateLimit(`visitor_log_phone_${normalizedPhone}`, 3, 60 * 60 * 1000);
    if (!phoneRate.allowed) {
      return NextResponse.json(
        { error: "تم تسجيل بيانات هذا الرقم عدة مرات. يرجى المحاولة لاحقاً." },
        { status: 429, headers: { "Retry-After": String(phoneRate.retryAfterSeconds) } }
      );
    }

    const user = await getCurrentUser(request);
    const details = {
      name,
      phone: normalizedPhone,
      propertyTitle: title,
      category,
      transactionType,
      isProject,
      submittedBy: user ? "account" : "guest",
    };
    const visitorId = randomUUID();

    if (isSupabaseDirect()) {
      const supabaseAdmin = createAdminClient();
      const userId = user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
        ? user.id
        : null;
      const { error } = await supabaseAdmin.from("audit_events").insert({
        user_id: userId,
        action: "VISITOR_PROPERTY_CONTACT_CAPTURED",
        entity_type: "visitor_log",
        entity_id: visitorId,
        details,
      });
      if (error) {
        console.error("Failed to save property visitor contact:", error);
        return NextResponse.json({ error: "تعذر حفظ بيانات التواصل. يرجى المحاولة مرة أخرى." }, { status: 500 });
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "خدمة تسجيل بيانات الزوار غير متاحة حالياً" }, { status: 503 });
    } else {
      dbStore.recordAuditEvent(
        user?.id,
        "VISITOR_PROPERTY_CONTACT_CAPTURED",
        "visitor_log",
        visitorId,
        details
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to capture property visitor contact:", error);
    const message = error instanceof Error ? error.message : "تعذر تسجيل بيانات التواصل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
