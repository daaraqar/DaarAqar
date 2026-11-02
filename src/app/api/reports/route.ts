import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { ReportReasonCategory } from "@/lib/db/types";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { createAdminClient } from "@/utils/supabase/server";

const VALID_CATEGORIES: ReportReasonCategory[] = [
  "misleading_details",
  "duplicate_listing",
  "unavailable",
  "suspected_fraud",
  "other",
];

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { propertyId, reasonCategory, details, reporterName, reporterPhone } = body;

    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "معرف العقار مطلوب" }, { status: 400 });
    }

    if (!reasonCategory || !VALID_CATEGORIES.includes(reasonCategory)) {
      return NextResponse.json(
        { error: "يرجى تحديد سبب صحيح للبلاغ من القائمة المتاحة" },
        { status: 400 }
      );
    }

    if (!details || !details.trim()) {
      return NextResponse.json({ error: "تفاصيل البلاغ مطلوبة" }, { status: 400 });
    }

    const report = dbStore.createPropertyReport({
      propertyId,
      reporterId: user?.id,
      reporterName: user?.name || reporterName?.trim() || "مستخدم الزائر",
      reporterPhone: user?.phone || reporterPhone?.trim(),
      reasonCategory,
      details,
    });

    if (isSupabaseDirect()) {
      const supabaseAdmin = createAdminClient();
      const isPropUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
      const isUserUuid = Boolean(user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id));

      if (isPropUuid) {
        const { error: supaErr } = await supabaseAdmin.from("property_reports").insert({
          property_id: propertyId,
          reporter_id: isUserUuid ? user!.id : null,
          reporter_name: report.reporterName,
          reporter_phone: report.reporterPhone || null,
          reason_category: reasonCategory,
          details: details.trim(),
          status: "pending",
        });
        if (supaErr && process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: `فشل تسجيل البلاغ في قاعدة البيانات السحابية: ${supaErr.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: "تم استلام البلاغ وسيتم مراجعته بواسطة فريق الامتثال والإشراف",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تقديم البلاغ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
