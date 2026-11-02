import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { UUID_PATTERN, mapRatingsConfig } from "@/lib/ratings/reputation";
import { fetchAllRows } from "@/lib/ratings/reputation";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "ratings.manage")) {
      return NextResponse.json({ success: false, error: "غير مصرح بإدارة التقييمات" }, { status: 403 });
    }

    const client = createAdminClient();
    const page = Math.max(0, Number(new URL(req.url).searchParams.get("page")) || 0);
    const pageSize = 50;
    const start = page * pageSize;
    const [
      { data: configRow, error: configError },
      { data: reviews, error: reviewsError, count: reviewCount },
      { data: reports, error: reportsError, count: reportCount },
      { data: auditEvents, error: auditError },
      { data: overrides, error: overridesError },
      subjectRows,
    ] = await Promise.all([
      client.from("ratings_config").select("*").limit(1).maybeSingle(),
      client
        .from("seller_reviews")
        .select("id,inquiry_id,property_id,seller_id,reviewer_id,seller_name,reviewer_name,rating,comment,status,created_at,properties(title,slug)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1),
      client
        .from("rating_reports")
        .select("id,review_id,reporter_id,reason,status,resolution_note,created_at,resolved_at,seller_reviews(seller_name,reviewer_name,rating,comment)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1),
      client
        .from("audit_events")
        .select("id,user_id,action,entity_id,details,created_at")
        .eq("entity_type", "ratings")
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("rating_badge_overrides")
        .select("subject_type,subject_id,badge_type,enabled,reason,updated_by,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100),
      fetchAllRows((from, to) =>
        client
          .from("properties")
          .select("id,title,is_project,advertiser_id,profiles(name)")
          .eq("status", "published")
          .range(from, to)
      ),
    ]);
    if (configError || reviewsError || reportsError || auditError || overridesError) {
      throw new Error(
        configError?.message ||
          reviewsError?.message ||
          reportsError?.message ||
          auditError?.message ||
          overridesError?.message ||
          "تعذر تحميل بيانات الإدارة"
      );
    }
    const subjectMap = new Map<string, { id: string; type: "seller" | "project"; label: string }>();
    for (const property of subjectRows) {
      if (property.is_project) {
        subjectMap.set(`project:${property.id}`, {
          id: property.id,
          type: "project",
          label: property.title || property.id,
        });
      }
      if (property.advertiser_id) {
        const profile = Array.isArray(property.profiles) ? property.profiles[0] : property.profiles;
        subjectMap.set(`seller:${property.advertiser_id}`, {
          id: property.advertiser_id,
          type: "seller",
          label: profile?.name || property.advertiser_id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      config: mapRatingsConfig(configRow),
      reviews: reviews ?? [],
      reports: reports ?? [],
      page,
      pageSize,
      reviewCount: reviewCount ?? 0,
      reportCount: reportCount ?? 0,
      hasMoreReviews: start + pageSize < (reviewCount ?? 0),
      hasMoreReports: start + pageSize < (reportCount ?? 0),
      auditEvents: auditEvents ?? [],
      overrides: overrides ?? [],
      subjects: Array.from(subjectMap.values()),
    });
  } catch (error) {
    console.error("[admin/ratings] Failed to load ratings administration:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر تحميل لوحة التقييمات" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "ratings.manage")) {
      return NextResponse.json({ success: false, error: "غير مصرح بإدارة التقييمات" }, { status: 403 });
    }

    const body = await req.json();
    const valid =
      typeof body.sellerRatingsEnabled === "boolean" &&
      typeof body.sellerBadgeEnabled === "boolean" &&
      typeof body.projectBadgeEnabled === "boolean" &&
      Number.isFinite(body.sellerMinRating) &&
      body.sellerMinRating >= 1 &&
      body.sellerMinRating <= 5 &&
      Number.isInteger(body.sellerMinReviews) &&
      body.sellerMinReviews >= 1 &&
      body.sellerMinReviews <= 1000 &&
      Number.isInteger(body.projectMinFavorites) &&
      body.projectMinFavorites >= 1 &&
      body.projectMinFavorites <= 100000 &&
      Number.isInteger(body.projectWindowDays) &&
      body.projectWindowDays >= 1 &&
      body.projectWindowDays <= 365 &&
      ["district_category", "city_category", "platform_wide"].includes(body.rankingScope);
    if (!valid) {
      return NextResponse.json({ success: false, error: "قيم إعدادات المنافسة غير صالحة" }, { status: 400 });
    }

    const client = createAdminClient();
    const { data: previous, error: readError } = await client
      .from("ratings_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (readError) throw new Error(`تعذر قراءة الإعدادات الحالية: ${readError.message}`);
    if (!previous) {
      throw new Error("إعدادات التقييمات غير موجودة في قاعدة البيانات؛ أعد تطبيق ترحيل التقييمات.");
    }

    const { data: updated, error: updateError } = await client
      .from("ratings_config")
      .update({
        seller_ratings_enabled: body.sellerRatingsEnabled,
        seller_badge_enabled: body.sellerBadgeEnabled,
        project_badge_enabled: body.projectBadgeEnabled,
        seller_min_rating: body.sellerMinRating,
        seller_min_reviews: body.sellerMinReviews,
        project_min_favorites: body.projectMinFavorites,
        project_window_days: body.projectWindowDays,
        ranking_scope: body.rankingScope,
        updated_by: UUID_PATTERN.test(user.id) ? user.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", previous.id)
      .select("*")
      .maybeSingle();
    if (updateError) throw new Error(`تعذر حفظ الإعدادات: ${updateError.message}`);
    if (!updated) throw new Error("لم يتم تحديث إعدادات التقييمات؛ تحقق من صف الإعدادات في قاعدة البيانات.");

    const { error: auditError } = await client.from("audit_events").insert({
      user_id: UUID_PATTERN.test(user.id) ? user.id : null,
      action: "RATINGS_CONFIG_UPDATED",
      entity_type: "ratings",
      entity_id: "global",
      details: {
        before: mapRatingsConfig(previous),
        after: mapRatingsConfig(updated),
      },
    });
    if (auditError) throw new Error(`تم حفظ الإعدادات لكن تعذر تسجيل أثر التدقيق: ${auditError.message}`);

    return NextResponse.json({ success: true, config: mapRatingsConfig(updated) });
  } catch (error) {
    console.error("[admin/ratings] Failed to save ratings settings:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر حفظ الإعدادات" },
      { status: 500 }
    );
  }
}
