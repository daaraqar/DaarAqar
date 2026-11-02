import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";
import { SmartFeaturesConfig } from "@/lib/types/smartFeatures";
import { hasUnrestrictedAdminAccess } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (process.env.NODE_ENV === "production" && !hasUnrestrictedAdminAccess(user)) {
      return NextResponse.json({ success: false, error: "غير مصرح، يتطلب صلاحية مسؤول النظام" }, { status: 403 });
    }
    const config = await smartFeaturesStore.getConfigAsync();
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (process.env.NODE_ENV === "production" && !hasUnrestrictedAdminAccess(user)) {
      return NextResponse.json({ success: false, error: "غير مصرح، يتطلب صلاحية مسؤول النظام" }, { status: 403 });
    }
    const body = (await req.json()) as SmartFeaturesConfig;

    if (!body || !body.features) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const updated = await smartFeaturesStore.saveConfigAsync({
      ...body,
      updatedBy: user?.name || "Admin",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات المنظومة الذكية بنجاح في قاعدة البيانات المركزية",
      config: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
