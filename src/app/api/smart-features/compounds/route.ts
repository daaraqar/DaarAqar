import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  MEET_GHAMR_CITY_SLUG,
  MEET_GHAMR_DISTRICT_SLUGS,
  isMeetGhamrCity,
  resolveMeetGhamrDistrictSlug,
} from "@/lib/db/meet-ghamr-geography";

export const dynamic = "force-dynamic";

function hasCentralSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("placeholder") &&
      !key.includes("placeholder")
  );
}

export async function GET() {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const useCloud = hasCentralSupabase();

    if (useCloud) {
      const supabase = createSupabaseServerClient();
      const { data: city, error: cityError } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", MEET_GHAMR_CITY_SLUG)
        .maybeSingle();

      if (cityError) {
        return NextResponse.json(
          { success: false, error: `تعذر التحقق من مدينة ميت غمر: ${cityError.message}` },
          { status: 503 }
        );
      }
      if (!city) {
        return NextResponse.json({ success: true, compounds: [], totalRealProjects: 0, totalBenchmarkProjects: 0 });
      }

      const { data: districts, error: districtsError } = await supabase
        .from("districts")
        .select("id")
        .eq("city_id", city.id)
        .in("slug", MEET_GHAMR_DISTRICT_SLUGS);

      if (districtsError) {
        return NextResponse.json(
          { success: false, error: `تعذر جلب قرى ومناطق ميت غمر: ${districtsError.message}` },
          { status: 503 }
        );
      }
      const districtIds = districts?.map((district) => district.id) || [];
      if (districtIds.length === 0) {
        return NextResponse.json({ success: true, compounds: [], totalRealProjects: 0, totalBenchmarkProjects: 0 });
      }

      const { data, error } = await supabase
        .from("properties")
        .select(`
          *,
          property_images (url, alt, is_main, sort_order)
        `)
        .eq("status", "published")
        .eq("is_project", true)
        .eq("city_id", city.id)
        .in("district_id", districtIds)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json(
          { success: false, error: `فشل الاتصال بقاعدة البيانات المركزية للمشروعات: ${error.message}` },
          { status: 503 }
        );
      }

      const mappedCloudProjects = (data || []).map((row: any) => {
        const imgs = Array.isArray(row.property_images) && row.property_images.length > 0
          ? row.property_images
              .sort((a: any, b: any) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.sort_order - b.sort_order)
              .map((img: any) => img.url)
          : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"];

        return {
          id: row.id,
          slug: row.slug,
          nameAr: row.title,
          nameEn: row.title,
          developerNameAr: row.advertiser_type === "broker" ? "وسيط ومطور معتمد" : "مالك مباشر",
          districtNameAr: row.address_details || "مركز ميت غمر",
          lat: Number(row.exact_lat || 30.7194),
          lng: Number(row.exact_lng || 31.258),
          totalAreaFeddan: Number((Number(row.area_sqm || 150) / 4200.83).toFixed(2)) || 1,
          deliveryYear: row.year_built || new Date().getFullYear(),
          startingPrice: Number(row.price),
          installmentYearsMax: row.installment_years || 5,
          downPaymentPercent: row.down_payment ? Math.min(100, Math.round((Number(row.down_payment) / Number(row.price)) * 100)) : 10,
          coverImage: imgs[0],
          masterplanMapUrl: imgs[1] || imgs[0],
          descriptionAr: row.description,
          availableUnitsCount: row.bedrooms || 1,
          amenities: [],
          category: row.category,
          isRealProperty: true,
        };
      });

      return NextResponse.json({
        success: true,
        compounds: mappedCloudProjects,
        totalRealProjects: mappedCloudProjects.length,
        totalBenchmarkProjects: 0,
      });
    }

    if (isProd) {
      return NextResponse.json(
        { success: false, error: "قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج" },
        { status: 503 }
      );
    }

    // Development / test fallback only
    const localProperties = dbStore
      .getAllPropertiesForAdmin()
      .filter(
        (property) =>
          property.status === "published" &&
          property.isProject === true &&
          isMeetGhamrCity(property.cityId) &&
          resolveMeetGhamrDistrictSlug(property.districtId) !== null
      );

    const mappedLocalProjects = localProperties.map((p) => {
      const coverImg = p.images && p.images.length > 0
        ? p.images[0]
        : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80";
      const secondImg = p.images && p.images.length > 1 ? p.images[1] : coverImg;

      return {
        id: p.id,
        slug: p.slug,
        nameAr: p.title,
        nameEn: p.title,
        developerNameAr: (p as any).advertiserName || (p.advertiserType === "broker" ? "وسيط ومطور معتمد" : "مالك مباشر"),
        districtNameAr: p.addressDetails || "مدينة ميت غمر",
        lat: p.lat,
        lng: p.lng,
        totalAreaFeddan: Number((p.areaSqM / 4200.83).toFixed(2)) || 1,
        deliveryYear: p.yearBuilt || new Date().getFullYear(),
        startingPrice: p.price,
        installmentYearsMax: p.installmentYears || 5,
        downPaymentPercent: p.downPayment ? Math.min(100, Math.round((p.downPayment / p.price) * 100)) : 10,
        coverImage: coverImg,
        masterplanMapUrl: secondImg,
        descriptionAr: p.description,
        availableUnitsCount: p.bedrooms || 1,
        amenities: p.amenities || [],
        category: p.category,
        isRealProperty: true,
      };
    });

    return NextResponse.json({
      success: true,
      compounds: mappedLocalProjects,
      totalRealProjects: mappedLocalProjects.length,
      totalBenchmarkProjects: 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
