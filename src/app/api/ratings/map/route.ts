import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  fetchAllRows,
  getRatingGroupKey,
  mapRatingsConfig,
  UUID_PATTERN,
} from "@/lib/ratings/reputation";

export const dynamic = "force-dynamic";

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(req: Request) {
  try {
    const ids = new URL(req.url).searchParams
      .get("ids")
      ?.split(",")
      .filter((id) => UUID_PATTERN.test(id))
      .slice(0, 100);
    if (!ids?.length) return NextResponse.json({ success: true, badges: {} });

    const client = createAdminClient();
    const [{ data: configRow, error: configError }, { data: properties, error: propertiesError }] =
      await Promise.all([
        client.from("ratings_config").select("*").limit(1).maybeSingle(),
        client
          .from("properties")
          .select("id,is_project,advertiser_id,city_id,district_id,category")
          .in("id", ids)
          .eq("status", "published"),
      ]);
    if (configError) throw new Error(`تعذر تحميل إعدادات التقييمات: ${configError.message}`);
    if (propertiesError) throw new Error(`تعذر تحميل بيانات العقارات للخريطة: ${propertiesError.message}`);
    const config = mapRatingsConfig(configRow);
    const rows = properties ?? [];
    const sellerIds = Array.from(
      new Set(
        rows
          .map((property) => property.advertiser_id)
          .filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id))
      )
    );
    const projectIds = rows.filter((property) => property.is_project).map((property) => property.id);
    const cutoff = new Date(Date.now() - config.projectWindowDays * 24 * 60 * 60 * 1000).toISOString();

    const [sellerReviewRows, favoriteRows, sellerOverridesResult, projectOverridesResult] =
      await Promise.all([
        config.sellerRatingsEnabled && sellerIds.length > 0
          ? fetchAllRows((start, end) =>
              client
                .from("seller_reviews")
                .select("seller_id,rating,properties!inner(city_id,district_id,category,status)")
                .eq("status", "published")
                .eq("properties.status", "published")
                .in("seller_id", sellerIds)
                .range(start, end)
            )
          : Promise.resolve([]),
        config.projectBadgeEnabled && projectIds.length > 0
          ? fetchAllRows((start, end) =>
              client
                .from("favorites")
                .select("user_id,property_id")
                .in("property_id", projectIds)
                .gte("created_at", cutoff)
                .range(start, end)
            )
          : Promise.resolve([]),
        sellerIds.length > 0
          ? client
              .from("rating_badge_overrides")
              .select("subject_id,enabled")
              .eq("subject_type", "seller")
              .eq("badge_type", "seller_highly_rated")
              .in("subject_id", sellerIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length > 0
          ? client
              .from("rating_badge_overrides")
              .select("subject_id,enabled")
              .eq("subject_type", "project")
              .eq("badge_type", "project_trending")
              .in("subject_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (sellerOverridesResult.error) {
      throw new Error(`تعذر تحميل شارات البائعين اليدوية: ${sellerOverridesResult.error.message}`);
    }
    if (projectOverridesResult.error) {
      throw new Error(`تعذر تحميل شارات المشاريع اليدوية: ${projectOverridesResult.error.message}`);
    }

    const sellerGroups = new Map<string, number[]>();
    for (const review of sellerReviewRows as Array<Record<string, any>>) {
      const property = relation(review.properties);
      if (!property) continue;
      const key = getRatingGroupKey(
        String(review.seller_id),
        property.city_id ?? null,
        property.district_id ?? null,
        property.category ?? null,
        config.rankingScope
      );
      const ratings = sellerGroups.get(key) ?? [];
      ratings.push(Number(review.rating));
      sellerGroups.set(key, ratings);
    }

    const favoritesByProject = new Map<string, Set<string>>();
    for (const favorite of favoriteRows as Array<Record<string, any>>) {
      const propertyId = String(favorite.property_id || "");
      const userId = String(favorite.user_id || "");
      if (!propertyId || !userId) continue;
      const users = favoritesByProject.get(propertyId) ?? new Set<string>();
      users.add(userId);
      favoritesByProject.set(propertyId, users);
    }

    const sellerOverrides = new Map(
      (sellerOverridesResult.data ?? []).map((override) => [override.subject_id, override.enabled])
    );
    const projectOverrides = new Map(
      (projectOverridesResult.data ?? []).map((override) => [override.subject_id, override.enabled])
    );
    const badges: Record<
      string,
      {
        sellerHighlyRated: boolean;
        projectTrending: boolean;
        ratingAverage: number | null;
        ratingCount: number;
        favoritesCount: number;
      }
    > = {};

    for (const property of rows) {
      const sellerId = property.advertiser_id;
      let ratingAverage: number | null = null;
      let ratingCount = 0;
      let sellerHighlyRated = false;
      if (sellerId && config.sellerRatingsEnabled && config.sellerBadgeEnabled) {
        const key = getRatingGroupKey(
          sellerId,
          property.city_id ?? null,
          property.district_id ?? null,
          property.category ?? null,
          config.rankingScope
        );
        const ratings = sellerGroups.get(key) ?? [];
        ratingCount = ratings.length;
        ratingAverage =
          ratingCount > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount : null;
        const override = sellerOverrides.get(sellerId);
        sellerHighlyRated =
          override === true ||
          (override !== false &&
            ratingCount >= config.sellerMinReviews &&
            ratingAverage !== null &&
            ratingAverage >= config.sellerMinRating);
      }

      const users = property.is_project ? favoritesByProject.get(property.id) : undefined;
      const favoritesCount = users?.size ?? 0;
      const override = property.is_project ? projectOverrides.get(property.id) : undefined;
      const projectTrending =
        config.projectBadgeEnabled &&
        property.is_project === true &&
        (override === true || (override !== false && favoritesCount >= config.projectMinFavorites));
      badges[property.id] = {
        sellerHighlyRated,
        projectTrending,
        ratingAverage,
        ratingCount,
        favoritesCount,
      };
    }

    return NextResponse.json({ success: true, badges });
  } catch (error) {
    console.error("[ratings/map] Failed to load map reputation badges:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر تحميل شارات الخريطة" },
      { status: 500 }
    );
  }
}
