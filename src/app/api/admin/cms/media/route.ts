import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { dbStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const assets = await dbStore.getCmsMediaAssetsAsync();
    return NextResponse.json({ assets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب مكتبة الوسائط";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const { url, altText, fileName, mimeType, fileSizeBytes } = body;

    if (!url || !fileName) {
      return NextResponse.json({ error: "رابط واسم الملف مطلوبان" }, { status: 400 });
    }

    const newAsset = await dbStore.addCmsMediaAssetAsync({
      url,
      altText: altText || fileName,
      fileName,
      mimeType: mimeType || "image/jpeg",
      fileSizeBytes: Number(fileSizeBytes) || 1024,
      uploadedBy: user.name || user.email || user.phone || "Admin",
    });

    return NextResponse.json({ success: true, asset: newAsset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء إضافة ملف الوسائط";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "معرف ملف الوسائط مطلوب" }, { status: 400 });
    }

    await dbStore.deleteCmsMediaAssetAsync(id, user);

    return NextResponse.json({ success: true, message: "تم حذف ملف الوسائط بنجاح" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف ملف الوسائط";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
