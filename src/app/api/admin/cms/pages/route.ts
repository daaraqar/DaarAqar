import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const pages = await dbStore.getCmsPagesAsync();
    return NextResponse.json({ pages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب الصفحات";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const { slug, titleAr, contentAr, metaTitle, metaDescription, isPublished } = body;

    if (!slug) {
      return NextResponse.json({ error: "معرف الصفحة (slug) مطلوب" }, { status: 400 });
    }

    const updated = await dbStore.updateCmsPageAsync(
      slug,
      { titleAr, contentAr, metaTitle, metaDescription, isPublished },
      user
    );

    return NextResponse.json({ success: true, page: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث الصفحة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
