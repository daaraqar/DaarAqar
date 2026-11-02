import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { price, areaSqM, category, districtId, transactionType } = body;

    if (!price || !areaSqM) {
      return NextResponse.json({ success: false, error: "Price and areaSqM are required" }, { status: 400 });
    }

    const config = smartFeaturesStore.getConfig();
    const fp = config.financialParams;

    // 1. Fair Price Index calculation
    const pricePerSqM = Math.round(price / areaSqM);
    const districtTrends = smartFeaturesStore.getMarketIndexTrends();
    const matchedDistrict = districtTrends.find((d) => d.districtId === districtId) || districtTrends[0];
    const avgDistrictPricePerSqM = matchedDistrict ? matchedDistrict.avgPricePerSqM : 38000;
    const deviationPercent = Math.round(((pricePerSqM - avgDistrictPricePerSqM) / avgDistrictPricePerSqM) * 100);

    let priceTag: "below_market" | "fair_price" | "overpriced" = "fair_price";
    let priceVerdictAr = "سعر عادل ومطابق لمتوسط السوق";

    if (deviationPercent < -8) {
      priceTag = "below_market";
      priceVerdictAr = `سعر منافس ومميز (أقل بـ ${Math.abs(deviationPercent)}% من متوسط الحي)`;
    } else if (deviationPercent > 12) {
      priceTag = "overpriced";
      priceVerdictAr = `سعر أعلى من متوسط الحي بـ ${deviationPercent}%`;
    }

    // 2. Inflation & Asset Hedge comparison
    const goldEquivalentGrams = Math.round(price / fp.goldGram24PriceEgp);
    // 3. Resale & Overprice Simulation
    const standardDownPayment = Math.round(price * 0.15); // 15%
    const estimatedOverprice = Math.round(price * 0.08); // 8% overprice in resale
    const cashRequiredForResale = standardDownPayment + estimatedOverprice;
    const maintenanceDeposit = Math.round(price * 0.08); // 8% وديعة صيانة
    const remainingInstallmentsAmount = price - standardDownPayment;
    const quarterlyInstallment5Years = Math.round(remainingInstallmentsAmount / (5 * 4));

    // 4. Comprehensive Net Rental Yield (Cap Rate)
    const estimatedMonthlyRent = Math.round(price * (category === "villa" ? 0.005 : 0.0065));
    const annualGrossRent = estimatedMonthlyRent * 12;
    const grossYieldPercent = Number(((annualGrossRent / price) * 100).toFixed(1));
    const maintenanceCostAnnual = Math.round(annualGrossRent * 0.08);
    const dispositionTax = Math.round(price * (fp.realEstateDispositionTaxPercent / 100));
    const netAnnualRent = annualGrossRent - maintenanceCostAnnual;
    const netYieldPercent = Number(((netAnnualRent / price) * 100).toFixed(1));

    // 5. Short-Term Rental / Daily Rate Potential
    const dailyRate = Math.round((estimatedMonthlyRent / 30) * 2.2);
    const projectedShortTermOccupancyDays = 180; // ~50% occupancy
    const projectedAnnualShortTermGross = dailyRate * projectedShortTermOccupancyDays;

    return NextResponse.json({
      success: true,
      data: {
        pricePerSqM,
        avgDistrictPricePerSqM,
        deviationPercent,
        priceTag,
        priceVerdictAr,
        hedge: {
          goldEquivalentGrams,
          projectedAppreciation3Years: Math.round(price * Math.pow(1 + fp.averageAnnualAppreciationRatePercent / 100, 3)),
          bankCertificate3YearsReturn: Math.round(price * (1 + (fp.bankCertificateAnnualYieldPercent / 100) * 3)),
        },
        resaleBreakdown: {
          standardDownPayment,
          estimatedOverprice,
          cashRequiredForResale,
          maintenanceDeposit,
          remainingInstallmentsAmount,
          quarterlyInstallment5Years,
        },
        roi: {
          estimatedMonthlyRent,
          annualGrossRent,
          grossYieldPercent,
          netAnnualRent,
          netYieldPercent,
          dispositionTax,
        },
        shortTerm: {
          dailyRate,
          projectedDays: projectedShortTermOccupancyDays,
          projectedAnnualGross: projectedAnnualShortTermGross,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
