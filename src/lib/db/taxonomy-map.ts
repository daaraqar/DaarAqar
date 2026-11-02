/**
 * AqarPulse Platform — Geographic Taxonomy UUID Resolver
 * Bridges frontend slugs/identifiers with PostgreSQL UUID primary keys.
 */

export const CITY_MAP: Record<string, string> = {
  // Slugs to UUID
  "cairo": "c1000000-0000-0000-0000-000000000001",
  "city-cairo": "c1000000-0000-0000-0000-000000000001",
  "giza": "c2000000-0000-0000-0000-000000000002",
  "city-giza": "c2000000-0000-0000-0000-000000000002",
  "alexandria": "c3000000-0000-0000-0000-000000000003",
  "city-alexandria": "c3000000-0000-0000-0000-000000000003",
  "dakahlia": "c4000000-0000-0000-0000-000000000004",
  "city-dakahlia": "c4000000-0000-0000-0000-000000000004",
};

export const DISTRICT_MAP: Record<string, string> = {
  // Slugs to UUID
  "new-cairo": "d1000000-0000-0000-0000-000000000001",
  "dist-new-cairo": "d1000000-0000-0000-0000-000000000001",
  "sheikh-zayed": "d2000000-0000-0000-0000-000000000002",
  "dist-sheikh-zayed": "d2000000-0000-0000-0000-000000000002",
  "6th-october": "d3000000-0000-0000-0000-000000000003",
  "dist-6th-october": "d3000000-0000-0000-0000-000000000003",
  "new-capital": "d4000000-0000-0000-0000-000000000004",
  "dist-new-capital": "d4000000-0000-0000-0000-000000000004",
  "maadi": "37c86081-4828-4b02-b592-b5225c6af6f8",
  "dist-maadi": "37c86081-4828-4b02-b592-b5225c6af6f8",

  // Meet Ghamr Center & Villages (مركز ومدينة ميت غمر - الدقهلية)
  "dist-meet-ghamr-city": "d5000000-0000-0000-0000-000000000001",
  "dist-daqados": "d5000000-0000-0000-0000-000000000002",
  "dist-tafahna-al-ashraf": "d5000000-0000-0000-0000-000000000003",
  "dist-damas": "d5000000-0000-0000-0000-000000000004",
  "dist-sehregt-kobra": "d5000000-0000-0000-0000-000000000005",
  "dist-atmida": "d5000000-0000-0000-0000-000000000006",
  "dist-kom-el-nour": "d5000000-0000-0000-0000-000000000007",
  "dist-beshla": "d5000000-0000-0000-0000-000000000008",
  "dist-awleela": "d5000000-0000-0000-0000-000000000009",
  "dist-dandit": "d5000000-0000-0000-0000-000000000010",
  "dist-sanfa": "d5000000-0000-0000-0000-000000000011",
  "dist-meet-yaeish": "d5000000-0000-0000-0000-000000000012",
  "dist-meet-abou-khaled": "d5000000-0000-0000-0000-000000000013",
  "dist-meet-el-faramawy": "d5000000-0000-0000-0000-000000000014",
  "dist-meet-el-qorashi": "d5000000-0000-0000-0000-000000000015",
  "dist-meet-mohsen": "d5000000-0000-0000-0000-000000000016",
  "dist-meet-el-ezz": "d5000000-0000-0000-0000-000000000017",
  "dist-meet-nagy": "d5000000-0000-0000-0000-000000000018",
  "dist-hala": "d5000000-0000-0000-0000-000000000019",
  "dist-serenga": "d5000000-0000-0000-0000-000000000020",
  "dist-sanbo-maqam": "d5000000-0000-0000-0000-000000000021",
  "dist-santmay": "d5000000-0000-0000-0000-000000000022",
  "dist-bachaloch": "d5000000-0000-0000-0000-000000000023",
  "dist-el-bouha": "d5000000-0000-0000-0000-000000000024",
  "dist-behida": "d5000000-0000-0000-0000-000000000025",
  "dist-gasfa": "d5000000-0000-0000-0000-000000000026",
  "dist-kafr-el-miqdam": "d5000000-0000-0000-0000-000000000027",
  "dist-kafr-serenga": "d5000000-0000-0000-0000-000000000028",
  "dist-kafr-el-shahid": "d5000000-0000-0000-0000-000000000029",
  "dist-kafr-el-wazir": "d5000000-0000-0000-0000-000000000030",
  "dist-kafr-behida": "d5000000-0000-0000-0000-000000000031",
  "dist-kafr-noaman": "d5000000-0000-0000-0000-000000000032",
  "dist-kafr-el-naeem": "d5000000-0000-0000-0000-000000000033",
  "dist-kafr-el-mohamadeya": "d5000000-0000-0000-0000-000000000034",
  "dist-kafr-el-sheikh-helal": "d5000000-0000-0000-0000-000000000035",
  "dist-kofour-el-behaita": "d5000000-0000-0000-0000-000000000036",
  "dist-kafr-abou-nabhan": "d5000000-0000-0000-0000-000000000037",
  "dist-kafr-ibrahim-youssef": "d5000000-0000-0000-0000-000000000038",
  "dist-kafr-attallah-soliman": "d5000000-0000-0000-0000-000000000039",
  "dist-kafr-ali-abdullah": "d5000000-0000-0000-0000-000000000040",

  // Dakahlia Major Centers & Cities (مراكز ومدن محافظة الدقهلية)
  "dist-mansoura-city": "d5000000-0000-0000-0000-000000000050",
  "dist-talkha-city": "d5000000-0000-0000-0000-000000000051",
  "dist-simballawin-city": "d5000000-0000-0000-0000-000000000052",
  "dist-aga-city": "d5000000-0000-0000-0000-000000000053",
  "dist-dikirnis-city": "d5000000-0000-0000-0000-000000000054",
  "dist-belqas-city": "d5000000-0000-0000-0000-000000000055",
  "dist-sherbin-city": "d5000000-0000-0000-0000-000000000056",
  "dist-gamasa-city": "d5000000-0000-0000-0000-000000000057",
  "dist-manzala-city": "d5000000-0000-0000-0000-000000000058",
  "dist-matareya-city": "d5000000-0000-0000-0000-000000000059",
  "dist-nabaroh-city": "d5000000-0000-0000-0000-000000000060",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveCityUuid(idOrSlug?: string | null): string {
  if (!idOrSlug) return "c1000000-0000-0000-0000-000000000001"; // Default Cairo
  if (UUID_REGEX.test(idOrSlug)) return idOrSlug;
  const mapped = CITY_MAP[idOrSlug.toLowerCase()];
  return mapped || "c1000000-0000-0000-0000-000000000001";
}

export function resolveDistrictUuid(idOrSlug?: string | null): string {
  if (!idOrSlug) return "d1000000-0000-0000-0000-000000000001"; // Default New Cairo
  if (UUID_REGEX.test(idOrSlug)) return idOrSlug;
  const mapped = DISTRICT_MAP[idOrSlug.toLowerCase()];
  return mapped || "d1000000-0000-0000-0000-000000000001";
}

export function resolveCityAndDistrictUuids(cityId?: string | null, districtId?: string | null): { cityId: string; districtId: string } {
  return {
    cityId: resolveCityUuid(cityId),
    districtId: resolveDistrictUuid(districtId),
  };
}

