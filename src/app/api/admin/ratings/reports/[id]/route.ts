import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { UUID_PATTERN } from "@/lib/ratings/reputation";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "ratings.manage")) {
      return NextResponse.json({ success: false, error: "غير مصرح بإدارة البلاغات" }, { status: 403 });
    }
    if (!UUID_PATTERN.test(params.id)) {
      return NextResponse.json({ success: false, error: "معرّف البلاغ غير صالح" }, { status: 400 });
    }

    const body = await req.json();
    const status = body.status;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!["resolved", "dismissed"].includes(status) || note.length < 5 || note.length > 500) {
      return NextResponse.json({ success: false, error: "الحالة وملاحظة الإجراء مطلوبتان" }, { status: 400 });
    }

    const client = createAdminClient();
    const { data: previous, error: readError } = await client
      .from("rating_reports")
      .select("id,status,review_id")
      .eq("id", params.id)
      .maybeSingle();
    if (readError) throw new Error(`تعذر تحميل البلاغ: ${readError.message}`);
    if (!previous) return NextResponse.json({ success: false, error: "البلاغ غير موجود" }, { status: 404 });

    const { error: updateError } = await client
      .from("rating_reports")
      .update({
        status,
        resolution_note: note,
        resolved_by: UUID_PATTERN.test(user.id) ? user.id : null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", params.id);
    if (updateError) throw new Error(`تعذر حفظ قرار البلاغ: ${updateError.message}`);

    const { error: auditError } = await client.from("audit_events").insert({
      user_id: UUID_PATTERN.test(user.id) ? user.id : null,
      action: "RATING_REPORT_RESOLVED",
      entity_type: "ratings",
      entity_id: params.id,
      details: { previousStatus: previous.status, status, reviewId: previous.review_id, note },
    });
    if (auditError) throw new Error(`تم تحديث البلاغ لكن تعذر تسجيل أثر التدقيق: ${auditError.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/ratings/reports] Failed to resolve rating report:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر حفظ قرار البلاغ" },
      { status: 500 }
    );
  }
}
