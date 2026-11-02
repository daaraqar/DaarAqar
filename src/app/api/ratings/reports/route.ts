import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { UUID_PATTERN } from "@/lib/ratings/reputation";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "سجّل الدخول للإبلاغ عن التقييم" }, { status: 401 });
    }
    if (!UUID_PATTERN.test(user.id)) {
      return NextResponse.json({ success: false, error: "تعذر ربط الحساب بقاعدة البيانات" }, { status: 403 });
    }

    const body = await req.json();
    const reviewId = typeof body.reviewId === "string" ? body.reviewId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!UUID_PATTERN.test(reviewId) || reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ success: false, error: "معرّف التقييم وسبب الإبلاغ مطلوبان" }, { status: 400 });
    }

    const client = createAdminClient();
    const { data: review, error: reviewError } = await client
      .from("seller_reviews")
      .select("id,seller_id,reviewer_id,status")
      .eq("id", reviewId)
      .eq("status", "published")
      .maybeSingle();
    if (reviewError) throw new Error(`تعذر التحقق من التقييم: ${reviewError.message}`);
    if (!review) return NextResponse.json({ success: false, error: "التقييم غير موجود" }, { status: 404 });
    if (review.seller_id === user.id || review.reviewer_id === user.id) {
      return NextResponse.json({ success: false, error: "لا يمكنك الإبلاغ عن تقييم كتبته أو تقييم للبائع نفسه" }, { status: 403 });
    }

    const { error: insertError } = await client.from("rating_reports").insert({
      review_id: reviewId,
      reporter_id: user.id,
      reason,
    });
    if (insertError?.code === "23505") {
      return NextResponse.json({ success: false, error: "سبق أن أبلغت عن هذا التقييم" }, { status: 409 });
    }
    if (insertError) throw new Error(`تعذر حفظ البلاغ: ${insertError.message}`);

    const { error: auditError } = await client.from("audit_events").insert({
      user_id: user.id,
      action: "SELLER_REVIEW_REPORTED",
      entity_type: "ratings",
      entity_id: reviewId,
      details: { reason },
    });
    if (auditError) {
      console.error("[ratings/reports] Could not record report audit event:", auditError.message);
    }
    return NextResponse.json({ success: true, message: "تم إرسال البلاغ لمراجعته" }, { status: 201 });
  } catch (error) {
    console.error("[ratings/reports] Failed to report review:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر إرسال البلاغ" },
      { status: 500 }
    );
  }
}
