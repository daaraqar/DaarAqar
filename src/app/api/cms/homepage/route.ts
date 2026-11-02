import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await dbStore.getCmsHomepageSettingsAsync();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب إعدادات الواجهة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || !hasAdminPermission(currentUser, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const updated = await dbStore.updateCmsHomepageSettingsAsync(body, currentUser);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث إعدادات الهوية والمحتوى";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
