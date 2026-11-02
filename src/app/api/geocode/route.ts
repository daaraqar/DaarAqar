import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/security";

const MEET_GHAMR_VIEWBOX = "31.10,30.88,31.42,30.55";

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ error: "اكتب 3 أحرف على الأقل للبحث عن موقع" }, { status: 400 });
  }

  const clientIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const rateLimit = checkRateLimit(`geocode:${clientIp}`, 8, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "تجاوزت عدد محاولات البحث عن المواقع، حاول بعد قليل" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const params = new URLSearchParams({
    q: `${query}, مركز ميت غمر، الدقهلية، مصر`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "eg",
    viewbox: MEET_GHAMR_VIEWBOX,
    bounded: "1",
    "accept-language": "ar",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "AqarBulz/1.0 (real-estate location search)",
        "Accept-Language": "ar",
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      throw new Error(`Geocoding provider returned ${response.status}`);
    }

    const results: NominatimResult[] = await response.json();
    const locations = results
      .map((result) => ({
        label: result.display_name?.trim() ?? "",
        lat: Number(result.lat),
        lng: Number(result.lon),
      }))
      .filter(
        (location) =>
          location.label &&
          Number.isFinite(location.lat) &&
          Number.isFinite(location.lng)
      );
    return NextResponse.json({ locations });
  } catch (error) {
    console.error("[Geocode] Failed to search locations:", error);
    return NextResponse.json(
      { error: "تعذر البحث عن الشوارع والأماكن حاليًا، حاول مرة أخرى" },
      { status: 502 }
    );
  }
}
