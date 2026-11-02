export type RankingScope = "district_category" | "city_category" | "platform_wide";

export interface RatingsConfig {
  sellerRatingsEnabled: boolean;
  sellerBadgeEnabled: boolean;
  projectBadgeEnabled: boolean;
  sellerMinRating: number;
  sellerMinReviews: number;
  projectMinFavorites: number;
  projectWindowDays: number;
  rankingScope: RankingScope;
}

export const DEFAULT_RATINGS_CONFIG: RatingsConfig = {
  sellerRatingsEnabled: true,
  sellerBadgeEnabled: true,
  projectBadgeEnabled: true,
  sellerMinRating: 4.5,
  sellerMinReviews: 5,
  projectMinFavorites: 10,
  projectWindowDays: 30,
  rankingScope: "district_category",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function configuredNumber(
  value: unknown,
  fallback: number,
  isValid: (numberValue: number) => boolean
): number {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && isValid(parsed) ? parsed : fallback;
}

export function mapRatingsConfig(row: Record<string, unknown> | null): RatingsConfig {
  if (!row) return DEFAULT_RATINGS_CONFIG;

  const scope = row.ranking_scope;
  return {
    sellerRatingsEnabled: row.seller_ratings_enabled === true,
    sellerBadgeEnabled: row.seller_badge_enabled === true,
    projectBadgeEnabled: row.project_badge_enabled === true,
    sellerMinRating: configuredNumber(
      row.seller_min_rating,
      DEFAULT_RATINGS_CONFIG.sellerMinRating,
      (value) => value >= 1 && value <= 5
    ),
    sellerMinReviews: configuredNumber(
      row.seller_min_reviews,
      DEFAULT_RATINGS_CONFIG.sellerMinReviews,
      (value) => Number.isInteger(value) && value >= 1 && value <= 1000
    ),
    projectMinFavorites: configuredNumber(
      row.project_min_favorites,
      DEFAULT_RATINGS_CONFIG.projectMinFavorites,
      (value) => Number.isInteger(value) && value >= 1 && value <= 100000
    ),
    projectWindowDays: configuredNumber(
      row.project_window_days,
      DEFAULT_RATINGS_CONFIG.projectWindowDays,
      (value) => Number.isInteger(value) && value >= 1 && value <= 365
    ),
    rankingScope:
      scope === "city_category" || scope === "platform_wide"
        ? scope
        : "district_category",
  };
}

export async function fetchAllRows<T>(
  makePage: (start: number, end: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await makePage(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function getRatingGroupKey(
  sellerId: string,
  cityId: string | null,
  districtId: string | null,
  category: string | null,
  scope: RankingScope
): string {
  if (scope === "platform_wide") return sellerId;
  if (scope === "city_category") return `${sellerId}:${cityId ?? ""}:${category ?? ""}`;
  return `${sellerId}:${districtId ?? ""}:${category ?? ""}`;
}
