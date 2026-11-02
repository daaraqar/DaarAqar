import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const config = smartFeaturesStore.getConfig();
    if (!config.features.interactiveFloorPlan2D) {
      return NextResponse.json(
        { success: false, error: "مستعرض المخططات المعمارية معطل حالياً" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId") || "default";
    const areaSqM = Number(searchParams.get("areaSqM")) || 180;

    const floorPlan = smartFeaturesStore.getFloorPlan(propertyId, areaSqM);

    return NextResponse.json({
      success: true,
      data: floorPlan,
    });
  } catch (error) {
    console.error("GET /api/smart-features/floor-plans error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب المخطط المعماري" },
      { status: 500 }
    );
  }
}
