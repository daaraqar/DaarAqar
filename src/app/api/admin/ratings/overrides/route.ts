import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { UUID_PATTERN } from "@/lib/ratings/reputation";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "ratings.manage")) {
      return NextResponse.json({ success: false, error: "غير مصرح بإدارة الشارات" }, { status: 403 });
    }

    const body = await req.json();
    const subjectType = body.subjectType;
    const badgeType = body.badgeType;
    const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (
      !["seller", "project"].includes(subjectType) ||
      !UUID_PATTERN.test(subjectId) ||
      !["seller_highly_rated", "project_trending"].includes(badgeType) ||
      (subjectType === "seller" && badgeType !== "seller_highly_rated") ||
      (subjectType === "project" && badgeType !== "project_trending") ||
      typeof body.enabled !== "boolean" ||
      reason.length < 5 ||
      reason.length > 500
    ) {
      return NextResponse.json({ success: false, error: "بيانات اعتماد الشارة وسببها غير صالحة" }, { status: 400 });
    }

    const client = createAdminClient();
    const table = subjectType === "seller" ? "profiles" : "properties";
    const { data: subject, error: subjectError } = await client
      .from(table)
      .select("id")
      .eq("id", subjectId)
      .maybeSingle();
    if (subjectError) throw new Error(`تعذر التحقق من العنصر: ${subjectError.message}`);
    if (!subject) return NextResponse.json({ success: false, error: "العنصر المطلوب غير موجود" }, { status: 404 });

    const { data: previous, error: readError } = await client
      .from("rating_badge_overrides")
      .select("enabled,reason")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .eq("badge_type", badgeType)
      .maybeSingle();
    if (readError) throw new Error(`تعذر قراءة حالة الشارة: ${readError.message}`);

    const { error: upsertError } = await client.from("rating_badge_overrides").upsert(
      {
        subject_type: subjectType,
        subject_id: subjectId,
        badge_type: badgeType,
        enabled: body.enabled,
        reason,
        updated_by: UUID_PATTERN.test(user.id) ? user.id : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "subject_type,subject_id,badge_type" }
    );
    if (upsertError) throw new Error(`تعذر حفظ الشارة: ${upsertError.message}`);

    const { error: auditError } = await client.from("audit_events").insert({
      user_id: UUID_PATTERN.test(user.id) ? user.id : null,
      action: body.enabled ? "RATING_BADGE_GRANTED" : "RATING_BADGE_REVOKED",
      entity_type: "ratings",
      entity_id: subjectId,
      details: {
        subjectType,
        badgeType,
        reason,
        previous: previous ?? null,
        enabled: body.enabled,
      },
    });
    if (auditError) throw new Error(`تم تغيير الشارة لكن تعذر تسجيل أثر التدقيق: ${auditError.message}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/ratings/overrides] Failed to update badge override:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر تعديل الشارة" },
      { status: 500 }
    );
  }
}
