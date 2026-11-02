import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";
import type { NeighborhoodIntelligence } from "@/lib/types/smartFeatures";

export const dynamic = "force-dynamic";

function isMeetGhamrNeighborhood(neighborhood: NeighborhoodIntelligence): boolean {
  return neighborhood.country === "EG" && neighborhood.cityNameAr.includes("ميت غمر");
}

export async function GET(req: NextRequest) {
  try {
    const config = await smartFeaturesStore.getConfigAsync();
    if (!config.features.communityLivabilityGuide) {
      return NextResponse.json(
        { success: false, error: "دليل الأحياء وجودة الحياة معطل حالياً" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (slug) {
      const item = await smartFeaturesStore.getNeighborhoodBySlugAsync(slug);
      if (!item || !isMeetGhamrNeighborhood(item)) {
        return NextResponse.json(
          { success: false, error: "الحي المطلوب غير موجود" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: item });
    }

    const list = (await smartFeaturesStore.getNeighborhoodsAsync()).filter(isMeetGhamrNeighborhood);
    return NextResponse.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/smart-features/neighborhoods error:", error);
    return NextResponse.json({ success: false, error: error?.message || "فشل استرجاع بيانات الأحياء" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await smartFeaturesStore.getConfigAsync();
    if (!config.features.communityLivabilityGuide) {
      return NextResponse.json(
        { success: false, error: "دليل الأحياء وجودة الحياة معطل حالياً" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { slug, residentName, yearsOfResidency, rating, comment } = body;

    if (!slug || !residentName || !rating || !comment) {
      return NextResponse.json(
        { success: false, error: "جميع بيانات التقييم واسم المقيم مطلوبة" },
        { status: 400 }
      );
    }

    const neighborhood = await smartFeaturesStore.getNeighborhoodBySlugAsync(slug);
    if (!neighborhood || !isMeetGhamrNeighborhood(neighborhood)) {
      return NextResponse.json({ success: false, error: "الحي غير موجود" }, { status: 404 });
    }

    const ok = await smartFeaturesStore.addNeighborhoodReviewAsync(slug, {
      residentName,
      yearsOfResidency: Number(yearsOfResidency) || 1,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment,
    });

    if (!ok) {
      return NextResponse.json({ success: false, error: "الحي غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "تم تسجيل تقييمك الحقيقي للحي بنجاح، شكراً لمشاركتك مجتمع دار العقار!",
    });
  } catch (error: any) {
    console.error("POST /api/smart-features/neighborhoods error:", error);
    return NextResponse.json({ success: false, error: error?.message || "فشل إضافة تقييم الحي" }, { status: 500 });
  }
}
