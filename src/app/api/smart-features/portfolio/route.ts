import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, items: [] });
    }
    const items = await smartFeaturesStore.getPortfolioItemsAsync(user.id);
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "يجب تسجيل الدخول لإضافة عقار للمحفظة" }, { status: 401 });
    }
    const userId = user.id;
    const body = await req.json();

    const {
      propertyTitle,
      purchasePrice,
      currentMarketEstimate,
      purchaseDate,
      rentalIncomeMonthly,
      tenantName,
      nextInstallmentDueDate,
      nextInstallmentAmount,
      installmentsRemainingCount,
      occupancyStatus,
    } = body;

    if (!propertyTitle || !purchasePrice) {
      return NextResponse.json({ success: false, error: "اسم العقار وسعر الشراء مطلوبان" }, { status: 400 });
    }

    const created = await smartFeaturesStore.addPortfolioItemAsync({
      userId,
      propertyTitle,
      purchasePrice: Number(purchasePrice),
      currentMarketEstimate: Number(currentMarketEstimate || purchasePrice),
      purchaseDate: purchaseDate || new Date().toISOString().split("T")[0],
      rentalIncomeMonthly: Number(rentalIncomeMonthly || 0),
      tenantName: tenantName || "",
      nextInstallmentDueDate: nextInstallmentDueDate || undefined,
      nextInstallmentAmount: nextInstallmentAmount ? Number(nextInstallmentAmount) : undefined,
      installmentsRemainingCount: installmentsRemainingCount ? Number(installmentsRemainingCount) : undefined,
      occupancyStatus: occupancyStatus || "rented",
    });

    return NextResponse.json({ success: true, message: "تمت إضافة العقار لمحفظتك الاستثمارية", item: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
