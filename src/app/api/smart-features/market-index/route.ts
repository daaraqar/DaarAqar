import { NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trends = smartFeaturesStore.getMarketIndexTrends();
    const config = smartFeaturesStore.getConfig();

    return NextResponse.json({
      success: true,
      data: {
        trends,
        financialParams: {
          goldGram24PriceEgp: config.financialParams.goldGram24PriceEgp,
          annualInflationRatePercent: config.financialParams.annualInflationRatePercent,
          averageAnnualAppreciationRatePercent: config.financialParams.averageAnnualAppreciationRatePercent,
        },
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
