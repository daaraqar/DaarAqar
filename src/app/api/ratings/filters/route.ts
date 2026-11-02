import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = createAdminClient();
    const [{ data: cities, error: citiesError }, { data: districts, error: districtsError }] =
      await Promise.all([
        client.from("cities").select("id,name_ar").order("name_ar", { ascending: true }),
        client.from("districts").select("id,city_id,name_ar").order("name_ar", { ascending: true }),
      ]);
    if (citiesError || districtsError) {
      throw new Error(citiesError?.message || districtsError?.message || "تعذر تحميل المناطق");
    }
    return NextResponse.json({
      success: true,
      cities: (cities ?? []).map((city) => ({ id: city.id, nameAr: city.name_ar })),
      districts: (districts ?? []).map((district) => ({
        id: district.id,
        cityId: district.city_id,
        nameAr: district.name_ar,
      })),
    });
  } catch (error) {
    console.error("[ratings/filters] Failed to load geographic filters:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر تحميل المناطق" },
      { status: 500 }
    );
  }
}
