import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const config = smartFeaturesStore.getConfig();
    if (!config.features.dynamicPaymentPlanVisualizer) {
      return NextResponse.json(
        { success: false, error: "حاسبة الأقساط الذكية معطلة حالياً" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { price, downPaymentPercent, years } = body;

    if (!price || Number(price) <= 0) {
      return NextResponse.json(
        { success: false, error: "سعر العقار غير صالح" },
        { status: 400 }
      );
    }

    const schedule = smartFeaturesStore.generatePaymentSchedule(
      Number(price),
      downPaymentPercent !== undefined ? Number(downPaymentPercent) : 10,
      years !== undefined ? Number(years) : 7
    );

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error("POST /api/smart-features/payment-plans error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إنشاء جدول الأقساط" },
      { status: 500 }
    );
  }
}
