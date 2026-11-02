import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (
      !hasAdminPermission(user, "projects.review") &&
      !hasAdminPermission(user, "projects.delete") &&
      !hasAdminPermission(user, "staff.manage")
    ) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مراجعة المشاريع" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;
    const entries = dbStore.getProjectAuditLog(projectId);
    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في جلب سجل المشاريع";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
