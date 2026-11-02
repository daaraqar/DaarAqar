import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      propertyId,
      propertyTitle,
      propertyAddress,
      requesterName,
      requesterPhone,
      requesterEmail,
      preferredDate,
      inspectionType,
    } = body;

    if (!propertyId || !requesterName || !requesterPhone || !preferredDate) {
      return NextResponse.json(
        { success: false, error: "بيانات حجز الفحص الهندسي غير مكتملة" },
        { status: 400 }
      );
    }

    const config = await smartFeaturesStore.getConfigAsync();
    const booking = await smartFeaturesStore.bookInspectionAsync({
      propertyId,
      propertyTitle: propertyTitle || "عقار بدون عنوان",
      propertyAddress: propertyAddress || "العنوان غير محدد",
      requesterName,
      requesterPhone,
      requesterEmail: requesterEmail || "",
      preferredDate,
      inspectionType: inspectionType || "full_civil_electrical",
      assignedEngineerName: "استشاري هندسي معتمد من دار العقار",
      scoreOverall: undefined,
      notes: "تم تسجيل الحجز وسيتواصل المهندس لتأكيد موعد المعاينة.",
    });

    return NextResponse.json({
      success: true,
      message: `تم حجز موعد الفحص الهندسي بنجاح بتكلفة أساسية ${config.inspectionParams.baseInspectionFeeEgp.toLocaleString("ar-EG")} ج.م.`,
      booking,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
