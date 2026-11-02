import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/utils/supabase/server";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const useCloud = isSupabaseDirect();

    if (useCloud) {
      const supabaseAdmin = createAdminClient();
      const [
        usersRes,
        propsRes,
        inquiriesRes,
        messagesRes,
        reportsRes,
      ] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, role, is_verified", { count: "exact" }),
        supabaseAdmin.from("properties").select("id, status", { count: "exact" }),
        supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("inquiry_messages").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("property_reports").select("id, status", { count: "exact" }),
      ]);

      const firstErr =
        usersRes.error ||
        propsRes.error ||
        inquiriesRes.error ||
        messagesRes.error ||
        reportsRes.error;

      if (firstErr) {
        return NextResponse.json(
          { error: `فشل الاتصال بقاعدة البيانات المركزية لإحصائيات الإدارة: ${firstErr.message}` },
          { status: 503 }
        );
      }

      const profilesList = usersRes.data || [];
      const propsList = propsRes.data || [];
      const reportsList = reportsRes.data || [];

      const stats = {
        totalProperties: propsRes.count ?? propsList.length,
        publishedProperties: propsList.filter(
          (p: any) => p.status === "published" || p.status === "active"
        ).length,
        pendingProperties: propsList.filter((p: any) => p.status === "pending_review").length,
        rejectedProperties: propsList.filter((p: any) => p.status === "rejected").length,
        totalInquiries: inquiriesRes.count ?? 0,
        totalUsers: usersRes.count ?? profilesList.length,
        verifiedBrokers: profilesList.filter(
          (u: any) => u.role === "broker" && Boolean(u.is_verified)
        ).length,
        openReportsCount: reportsList.filter(
          (r: any) => r.status === "open" || r.status === "under_review"
        ).length,
        totalMessagesCount: messagesRes.count ?? 0,
        totalReportsCount: reportsRes.count ?? reportsList.length,
      };

      return NextResponse.json({ stats, source: "supabase" });
    }

    if (isProd) {
      return NextResponse.json(
        { error: "قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج" },
        { status: 503 }
      );
    }

    const stats = { ...dbStore.getAdminStats() };
    return NextResponse.json({ stats, source: "local" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في جلب إحصائيات الإدارة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
