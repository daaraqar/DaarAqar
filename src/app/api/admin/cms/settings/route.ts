import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const result = await dbStore.getCmsHomepageSettingsForAdminAsync();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب إعدادات CMS";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !hasAdminPermission(user, "cms.edit")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const updated = await dbStore.updateCmsHomepageSettingsAsync(body, user);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حفظ إعدادات CMS";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
