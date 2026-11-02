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
      return NextResponse.json({ success: false, error: "غير مصرح بمراجعة التقييمات" }, { status: 403 });
    }
    if (!UUID_PATTERN.test(params.id)) {
      return NextResponse.json({ success: false, error: "معرّف التقييم غير صالح" }, { status: 400 });
    }

    const body = await req.json();
    const status = body.status;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!["published", "hidden"].includes(status) || reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ success: false, error: "الحالة وسبب القرار مطلوبان" }, { status: 400 });
    }

    const client = createAdminClient();
    const { data: previous, error: readError } = await client
      .from("seller_reviews")
      .select("id,status,seller_id,rating")
      .eq("id", params.id)
      .maybeSingle();
    if (readError) throw new Error(`تعذر تحميل التقييم: ${readError.message}`);
    if (!previous) return NextResponse.json({ success: false, error: "التقييم غير موجود" }, { status: 404 });

    const { error: updateError } = await client
      .from("seller_reviews")
      .update({ status })
      .eq("id", params.id);
    if (updateError) throw new Error(`تعذر تحديث حالة التقييم: ${updateError.message}`);

    const { error: auditError } = await client.from("audit_events").insert({
      user_id: UUID_PATTERN.test(user.id) ? user.id : null,
      action: status === "hidden" ? "SELLER_REVIEW_HIDDEN" : "SELLER_REVIEW_PUBLISHED",
      entity_type: "ratings",
      entity_id: params.id,
      details: { previousStatus: previous.status, status, reason },
    });
    if (auditError) throw new Error(`تم تحديث التقييم لكن تعذر تسجيل أثر التدقيق: ${auditError.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/ratings/reviews] Failed to moderate review:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر مراجعة التقييم" },
      { status: 500 }
    );
  }
}
