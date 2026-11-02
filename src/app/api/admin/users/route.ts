import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/utils/supabase/server";
import { normalizeEmail, normalizeEgyptianPhone } from "@/lib/auth/security";
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const role = searchParams.get("role");
    const status = searchParams.get("status"); // "active" | "suspended"
    const verified = searchParams.get("verified"); // "verified" | "unverified"

    const isProd = process.env.NODE_ENV === "production";
    const useCloud = isSupabaseDirect();

    if (isProd && !useCloud) {
      return NextResponse.json(
        { error: "قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج" },
        { status: 503 }
      );
    }

    const userById = new Map<string, any>();
    const emailIndex = new Map<string, string>();
    const phoneIndex = new Map<string, string>();

    let allProps: any[] = [];
    let allInquiries: any[] = [];
    let allReports: any[] = [];
    const cloudMsgCountByInq = new Map<string, number>();

    if (useCloud) {
      const supabaseAdmin = createAdminClient();
      const [profilesRes, propsRes, inqRes, msgsRes, reportsRes] = await Promise.all([
        supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("properties").select("id, advertiser_id, user_id, status, approved_at, published_at"),
        supabaseAdmin.from("inquiries").select("id, property_id, advertiser_id, seeker_id, seeker_phone"),
        supabaseAdmin.from("inquiry_messages").select("inquiry_id"),
        supabaseAdmin.from("property_reports").select("id, property_id, reporter_id"),
      ]);

      if (profilesRes.error) {
        return NextResponse.json(
          { error: `فشل جلب المستخدمين من قاعدة البيانات المركزية: ${profilesRes.error.message}` },
          { status: 503 }
        );
      }

      for (const cp of profilesRes.data || []) {
        const mapped = {
          id: cp.id,
          name: cp.name || cp.full_name || "مستخدم المنصة",
          email: cp.email || "",
          phone: cp.phone || undefined,
          role: cp.role || "seeker",
          isVerified: Boolean(cp.is_verified),
          isSuspended: Boolean(cp.is_suspended),
          suspensionReason: cp.suspension_reason || undefined,
          companyName: cp.company_name || undefined,
          licenseNumber: cp.license_number || undefined,
          commercialRegistrationNo: cp.commercial_registration_no || undefined,
          nationalId: cp.national_id || undefined,
          avatarUrl: cp.avatar_url || undefined,
          whatsappEnabled: cp.whatsapp_enabled ?? cp.whatsapp_opt_in ?? true,
          createdAt: cp.created_at || new Date().toISOString(),
        };
        userById.set(cp.id, mapped);
        const normEmail = mapped.email ? normalizeEmail(mapped.email) : null;
        const normPhone = mapped.phone ? normalizeEgyptianPhone(mapped.phone) : null;
        if (normEmail) emailIndex.set(normEmail, cp.id);
        if (normPhone) phoneIndex.set(normPhone, cp.id);
      }

      allProps = (propsRes.data || []).map((p: any) => ({
        id: p.id,
        advertiserId: p.advertiser_id || p.user_id,
        status: p.status,
        approvedAt: p.approved_at,
        publishedAt: p.published_at,
      }));
      allInquiries = (inqRes.data || []).map((i: any) => ({
        id: i.id,
        propertyId: i.property_id,
        advertiserId: i.advertiser_id,
        seekerId: i.seeker_id,
        seekerPhone: i.seeker_phone,
      }));
      for (const m of msgsRes.data || []) {
        cloudMsgCountByInq.set(m.inquiry_id, (cloudMsgCountByInq.get(m.inquiry_id) || 0) + 1);
      }
      allReports = (reportsRes.data || []).map((r: any) => ({
        id: r.id,
        propertyId: r.property_id,
        reporterId: r.reporter_id,
      }));
    } else {
      // Development / test fixture mode only
      const localUsers = dbStore.getAllUsersForAdmin();
      allProps = dbStore.getAllPropertiesForAdmin();
      allInquiries = dbStore.getAllInquiriesForAdmin();
      allReports = dbStore.getPropertyReports();

      for (const u of localUsers) {
        userById.set(u.id, { ...u });
        const normEmail = u.email ? normalizeEmail(u.email) : null;
        const normPhone = u.phone ? normalizeEgyptianPhone(u.phone) : null;
        if (normEmail) emailIndex.set(normEmail, u.id);
        if (normPhone) phoneIndex.set(normPhone, u.id);
      }
    }

    let filtered = Array.from(userById.values());

    if (role && role !== "all") {
      filtered = filtered.filter((u) => u.role === role);
    }

    if (status === "suspended") {
      filtered = filtered.filter((u) => !!u.isSuspended);
    } else if (status === "active") {
      filtered = filtered.filter((u) => !u.isSuspended);
    }

    if (verified === "verified") {
      filtered = filtered.filter((u) => !!u.isVerified);
    } else if (verified === "unverified") {
      filtered = filtered.filter((u) => !u.isVerified);
    }

    if (search) {
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(search)) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.phone && u.phone.includes(search)) ||
          (u.companyName && u.companyName.toLowerCase().includes(search)) ||
          (u.licenseNumber && u.licenseNumber.toLowerCase().includes(search))
      );
    }

    const usersWithStats = filtered.map((u) => {
      const userProps = allProps.filter((p) => p.advertiserId === u.id);
      const userPropIds = new Set(userProps.map((p) => p.id));

      const inquiriesSent = allInquiries.filter(
        (i) =>
          i.seekerId === u.id ||
          (u.phone && i.seekerPhone && normalizeEgyptianPhone(i.seekerPhone) === normalizeEgyptianPhone(u.phone))
      );
      const inquiriesReceived = allInquiries.filter(
        (i) => i.advertiserId === u.id || userPropIds.has(i.propertyId)
      );

      const involvedInquiries = new Map<string, any>();
      for (const i of inquiriesSent) involvedInquiries.set(i.id, i);
      for (const i of inquiriesReceived) involvedInquiries.set(i.id, i);

      let messagesCount = 0;
      for (const inq of Array.from(involvedInquiries.values())) {
        if (useCloud) {
          messagesCount += cloudMsgCountByInq.get(inq.id) || 1;
        } else {
          messagesCount += Array.isArray(inq.messages) ? inq.messages.length : 1;
        }
      }

      const reportsFiledCount = allReports.filter((r) => r.reporterId === u.id).length;
      const reportsAgainstCount = allReports.filter((r) => userPropIds.has(r.propertyId)).length;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isVerified: !!u.isVerified,
        isSuspended: !!u.isSuspended,
        suspensionReason: u.suspensionReason,
        companyName: u.companyName,
        licenseNumber: u.licenseNumber,
        commercialRegistrationNo: u.commercialRegistrationNo,
        nationalId: u.nationalId,
        avatarUrl: u.avatarUrl,
        whatsappEnabled: u.whatsappEnabled ?? true,
        propertiesCount: userProps.length,
        publishedCount: userProps.filter((p) => p.status === "published" || p.status === ("active" as any)).length,
        publisherProjectCount: userProps.filter((p) =>
          Boolean(p.approvedAt || p.publishedAt) ||
          ["published", "active", "sold", "rented", "paused", "archived"].includes(p.status)
        ).length,
        pendingReviewCount: userProps.filter((p) => p.status === "pending_review").length,
        rejectedCount: userProps.filter((p) => p.status === "rejected").length,
        inquiriesSentCount: inquiriesSent.length,
        inquiriesReceivedCount: inquiriesReceived.length,
        totalConversationsCount: involvedInquiries.size,
        messagesCount,
        reportsFiledCount,
        reportsAgainstCount,
        createdAt: u.createdAt,
      };
    });

    return NextResponse.json({ users: usersWithStats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب قائمة المستخدمين";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
