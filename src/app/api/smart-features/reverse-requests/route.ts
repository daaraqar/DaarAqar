import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cityId = searchParams.get("cityId") || undefined;
    const requests = await smartFeaturesStore.getReverseRequestsAsync(cityId);

    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const {
      title,
      districtNameAr,
      cityId,
      districtId,
      category,
      transactionType,
      minBudget,
      maxBudget,
      minArea,
      maxArea,
      bedrooms,
      notes,
      userName,
      userPhone,
    } = body;

    if (!title || !minBudget || !maxBudget || !userName || !userPhone) {
      return NextResponse.json(
        { success: false, error: "جميع الحقول الإلزامية مطلوبة (العنوان، الميزانية، بيانات التواصل)" },
        { status: 400 }
      );
    }

    const created = await smartFeaturesStore.addReverseRequestAsync({
      userId: user?.id || `usr-${Date.now()}`,
      userName,
      userPhone,
      title,
      cityId: cityId || "cairo",
      districtId: districtId || "new-cairo",
      districtNameAr: districtNameAr || "ميت غمر",
      category: category || "apartment",
      transactionType: transactionType || "sale",
      minBudget: Number(minBudget),
      maxBudget: Number(maxBudget),
      minArea: Number(minArea || 100),
      maxArea: maxArea ? Number(maxArea) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      notes: notes || "",
      urgency: "flexible",
    });

    return NextResponse.json({
      success: true,
      message: "تم نشر طلبك العقاري بنجاح! سيتنافس الوسطاء والملاك لتقديم العروض المناسبة.",
      request: created,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
