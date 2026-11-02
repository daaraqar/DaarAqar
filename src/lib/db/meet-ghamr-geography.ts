import { initialDistricts } from "./seed-data";
import { City, District } from "./types";

export const MEET_GHAMR_CITY_ID = "city-dakahlia";
export const MEET_GHAMR_CITY_SLUG = "dakahlia";
export const MEET_GHAMR_CITY_UUID = "c4000000-0000-0000-0000-000000000004";

const OUT_OF_SCOPE_DISTRICT_IDS = new Set([
  "dist-mansoura-city",
  "dist-talkha-city",
  "dist-simballawin-city",
  "dist-aga-city",
  "dist-dikirnis-city",
  "dist-belqas-city",
  "dist-sherbin-city",
  "dist-gamasa-city",
  "dist-manzala-city",
  "dist-matareya-city",
  "dist-nabaroh-city",
]);

export const MEET_GHAMR_CITY: City = {
  id: MEET_GHAMR_CITY_ID,
  slug: MEET_GHAMR_CITY_SLUG,
  nameAr: "مركز ميت غمر",
  nameEn: "Meet Ghamr",
  centerLat: 30.7194,
  centerLng: 31.258,
  zoom: 13,
};

export const MEET_GHAMR_DISTRICTS = initialDistricts.filter(
  (district) =>
    district.cityId === MEET_GHAMR_CITY_ID &&
    !OUT_OF_SCOPE_DISTRICT_IDS.has(district.id)
);

export const MEET_GHAMR_DISTRICT_IDS = MEET_GHAMR_DISTRICTS.map((district) => district.id);
export const MEET_GHAMR_DISTRICT_SLUGS = MEET_GHAMR_DISTRICTS.map((district) => district.slug);

export function getMeetGhamrDistrictSeedRows(cityId: string) {
  return MEET_GHAMR_DISTRICTS.map((district) => ({
    city_id: cityId,
    slug: district.slug,
    name_ar: district.nameAr,
    name_en: district.nameEn,
    center_location: `SRID=4326;POINT(${district.centerLng} ${district.centerLat})`,
  }));
}

const MEET_GHAMR_DISTRICT_ALIASES: Record<string, string> = {
  "dist-mit-ghamr-city": "meet-ghamr-city",
  "dist-mitghamr-city": "meet-ghamr-city",
};

export function isMeetGhamrCity(idOrSlug?: string | null): boolean {
  if (!idOrSlug) return false;
  const normalized = idOrSlug.toLowerCase();
  return [
    MEET_GHAMR_CITY_ID,
    MEET_GHAMR_CITY_SLUG,
    `city-${MEET_GHAMR_CITY_SLUG}`,
    MEET_GHAMR_CITY_UUID,
  ].includes(normalized);
}

export function resolveMeetGhamrDistrictSlug(idOrSlug?: string | null): string | null {
  if (!idOrSlug) return null;
  const normalized = idOrSlug.toLowerCase();
  const aliasSlug = MEET_GHAMR_DISTRICT_ALIASES[normalized];
  if (aliasSlug) return aliasSlug;

  const district = MEET_GHAMR_DISTRICTS.find(
    (candidate) =>
      candidate.id.toLowerCase() === normalized ||
      candidate.slug.toLowerCase() === normalized
  );
  return district?.slug ?? null;
}

export function filterMeetGhamrDistricts(districts: District[]): District[] {
  const allowedIds = new Set(MEET_GHAMR_DISTRICT_IDS);
  const allowedSlugs = new Set(MEET_GHAMR_DISTRICT_SLUGS);
  return districts.filter(
    (district) =>
      [MEET_GHAMR_CITY_ID, MEET_GHAMR_CITY_SLUG, MEET_GHAMR_CITY_UUID].includes(district.cityId) &&
      (allowedIds.has(district.id) || allowedSlugs.has(district.slug))
  );
}
