import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient, createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { normalizeEgyptianPhone } from "@/lib/auth/security";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { isCentralDbEnabled } from "@/lib/services/inquiryResolver";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveTargetUser(userId: string) {
  let targetUser = dbStore.findUserById(userId);
  if (!targetUser && UUID_REGEX.test(userId) && isCentralDbEnabled()) {
    const supabaseAdmin = createAdminClient();
    const { data: cp, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      throw new Error(`تعذر جلب ملف المستخدم من قاعدة البيانات المركزية: ${error.message}`);
    }
    if (cp) {
      targetUser = dbStore.ensureUser({
        id: cp.id,
        name: cp.name || cp.full_name || "مستخدم المنصة",
        email: cp.email || "",
        phone: cp.phone || "",
        role: cp.role || "seeker",
        isVerified: !!cp.is_verified,
        isSuspended: !!cp.is_suspended,
        suspensionReason: cp.suspension_reason || undefined,
        companyName: cp.company_name || undefined,
        licenseNumber: cp.license_number || undefined,
        commercialRegistrationNo: cp.commercial_registration_no || undefined,
        nationalId: cp.national_id || undefined,
        avatarUrl: cp.avatar_url || undefined,
        whatsappEnabled: cp.whatsapp_enabled ?? cp.whatsapp_opt_in ?? true,
        createdAt: cp.created_at || new Date().toISOString(),
      });
    }
  }
  return targetUser;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    let targetUser = await resolveTargetUser(params.id);
    if (!targetUser) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }
    let profileUser = targetUser;

    let properties: any[] = dbStore.getPropertiesByAdvertiser(params.id);
    const propIds = new Set(properties.map((p) => p.id));

    const allInquiries = dbStore.getAllInquiriesForAdmin();
    let inquiriesSent = allInquiries.filter(
      (i) =>
        i.seekerId === targetUser.id ||
        (targetUser.phone &&
          i.seekerPhone &&
          normalizeEgyptianPhone(i.seekerPhone) === normalizeEgyptianPhone(targetUser.phone))
    );
    let inquiriesReceived = allInquiries.filter(
      (i) => i.advertiserId === targetUser.id || propIds.has(i.propertyId)
    );

    const allReports = dbStore.getPropertyReports();
    let reports: any[] = allReports.filter(
      (r) => r.reporterId === targetUser.id || propIds.has(r.propertyId)
    );

    let auditLogs: any[] = dbStore
      .getAuditEvents()
      .filter((ev) => ev.entityId === targetUser.id || ev.userId === targetUser.id);

    if (isCentralDbEnabled() && UUID_REGEX.test(params.id)) {
      const supabaseAdmin = createAdminClient();
      const phoneCandidates = Array.from(new Set([
        targetUser.phone,
        targetUser.phone ? normalizeEgyptianPhone(targetUser.phone) : "",
      ].filter(Boolean)));
      const [profileResult, propertiesResult, inquiriesBySeekerResult, inquiriesByPhoneResult, inquiriesByAdvertiserResult] =
        await Promise.all([
          supabaseAdmin.from("profiles").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin
            .from("properties")
            .select("*")
            .or(`advertiser_id.eq.${params.id},user_id.eq.${params.id},owner_id.eq.${params.id}`),
          supabaseAdmin.from("inquiries").select("*").eq("seeker_id", params.id),
          phoneCandidates.length > 0
            ? supabaseAdmin.from("inquiries").select("*").in("seeker_phone", phoneCandidates)
            : Promise.resolve({ data: [], error: null }),
          supabaseAdmin.from("inquiries").select("*").eq("advertiser_id", params.id),
        ]);
      const cloudErrors = [
        profileResult.error,
        propertiesResult.error,
        inquiriesBySeekerResult.error,
        inquiriesByPhoneResult.error,
        inquiriesByAdvertiserResult.error,
      ].filter(Boolean);
      if (cloudErrors.length > 0) {
        throw new Error(`تعذر تحميل السجل السحابي للمستخدم: ${cloudErrors[0]?.message}`);
      }

      const cloudProperties = propertiesResult.data || [];
      const cloudPropertyIds = cloudProperties.map((property: any) => property.id);
      const inquiriesByPropertyResult = cloudPropertyIds.length > 0
        ? await supabaseAdmin.from("inquiries").select("*").in("property_id", cloudPropertyIds)
        : { data: [], error: null };
      if (inquiriesByPropertyResult.error) {
        throw new Error(`تعذر تحميل استفسارات مشروعات المستخدم: ${inquiriesByPropertyResult.error.message}`);
      }

      const profile = profileResult.data;
      if (profile) {
        profileUser = dbStore.ensureUser({
          id: profile.id,
          name: profile.name || profile.full_name || profileUser.name,
          email: profile.email || profileUser.email || "",
          phone: profile.phone || profileUser.phone || "",
          role: profile.role || profileUser.role,
          isVerified: Boolean(profile.is_verified),
          isSuspended: Boolean(profile.is_suspended),
          suspensionReason: profile.suspension_reason || undefined,
          companyName: profile.company_name || undefined,
          licenseNumber: profile.license_number || undefined,
          commercialRegistrationNo: profile.commercial_registration_no || undefined,
          nationalId: profile.national_id || undefined,
          avatarUrl: profile.avatar_url || undefined,
          whatsappEnabled: profile.whatsapp_enabled ?? profile.whatsapp_opt_in ?? true,
          createdAt: profile.created_at || profileUser.createdAt,
        });
      }

      for (const property of cloudProperties) propIds.add(property.id);
      properties = Array.from(new Map([
        ...properties.map((property) => [property.id, property] as const),
        ...cloudProperties.map((property: any) => [property.id, {
          id: property.id,
          slug: property.slug,
          title: property.title,
          status: property.status,
          price: property.price,
          createdAt: property.created_at,
          updatedAt: property.updated_at,
        }] as const),
      ]).values());

      const cloudInquiries = Array.from(new Map([
        ...(inquiriesBySeekerResult.data || []),
        ...(inquiriesByPhoneResult.data || []),
        ...(inquiriesByAdvertiserResult.data || []),
        ...(inquiriesByPropertyResult.data || []),
      ].map((inquiry: any) => [inquiry.id, inquiry])).values());
      const cloudInquiryIds = cloudInquiries.map((inquiry: any) => inquiry.id);
      const propertyById = new Map(cloudProperties.map((property: any) => [property.id, property]));
      const messagesResult = cloudInquiryIds.length > 0
        ? await supabaseAdmin.from("inquiry_messages").select("inquiry_id").in("inquiry_id", cloudInquiryIds)
        : { data: [], error: null };
      if (messagesResult.error) {
        throw new Error(`تعذر تحميل أعداد رسائل المستخدم: ${messagesResult.error.message}`);
      }
      const messageCounts = new Map<string, number>();
      for (const message of messagesResult.data || []) {
        messageCounts.set(message.inquiry_id, (messageCounts.get(message.inquiry_id) || 0) + 1);
      }
      const mapCloudInquiry = (inquiry: any) => {
        const property = propertyById.get(inquiry.property_id);
        return {
          id: inquiry.id,
          propertyId: inquiry.property_id,
          propertyTitle: inquiry.property_title || property?.title || "استفسار عقاري",
          propertySlug: property?.slug,
          advertiserId: inquiry.advertiser_id || property?.advertiser_id || property?.user_id,
          seekerId: inquiry.seeker_id,
          seekerName: inquiry.seeker_name || profileUser.name,
          seekerPhone: inquiry.seeker_phone || profileUser.phone,
          seekerEmail: inquiry.seeker_email || profileUser.email,
          message: inquiry.message || "",
          status: inquiry.status || "new",
          createdAt: inquiry.created_at,
          lastMessageAt: inquiry.updated_at || inquiry.created_at,
          messagesCount: messageCounts.get(inquiry.id) || 0,
        };
      };
      const mappedCloudInquiries = cloudInquiries.map(mapCloudInquiry);
      inquiriesSent = Array.from(new Map([
        ...inquiriesSent.map((inquiry) => [inquiry.id, inquiry] as const),
        ...mappedCloudInquiries
          .filter((inquiry: any) =>
            inquiry.seekerId === profileUser.id ||
            (profileUser.phone && inquiry.seekerPhone &&
              normalizeEgyptianPhone(inquiry.seekerPhone) === normalizeEgyptianPhone(profileUser.phone))
          )
          .map((inquiry: any) => [inquiry.id, inquiry] as const),
      ]).values());
      inquiriesReceived = Array.from(new Map([
        ...inquiriesReceived.map((inquiry) => [inquiry.id, inquiry] as const),
        ...mappedCloudInquiries
          .filter((inquiry: any) => inquiry.advertiserId === profileUser.id || propIds.has(inquiry.propertyId))
          .map((inquiry: any) => [inquiry.id, inquiry] as const),
      ]).values());

      const propertyIds = Array.from(propIds).filter((id) => UUID_REGEX.test(id));
      const reportsQuery = supabaseAdmin
        .from("property_reports")
        .select("*")
        .or(`reporter_id.eq.${params.id}${propertyIds.length ? `,property_id.in.(${propertyIds.join(",")})` : ""}`);
      const auditQuery = supabaseAdmin
        .from("audit_events")
        .select("*")
        .or(`user_id.eq.${params.id},entity_id.eq.${params.id}`);
      const [reportsResult, auditResult] = await Promise.all([reportsQuery, auditQuery]);
      if (reportsResult.error || auditResult.error) {
        throw new Error(`تعذر تحميل البلاغات أو سجل التدقيق: ${reportsResult.error?.message || auditResult.error?.message}`);
      }
      reports = Array.from(new Map([
        ...reports.map((report) => [report.id, report] as const),
        ...(reportsResult.data || []).map((report: any) => [report.id, {
          id: report.id,
          propertyId: report.property_id,
          reporterId: report.reporter_id,
          reasonCategory: report.reason_category || "other",
          details: report.details || "",
          status: report.status || "pending",
          createdAt: report.created_at,
        }] as const),
      ]).values());
      auditLogs = Array.from(new Map([
        ...auditLogs.map((event) => [event.id, event] as const),
        ...(auditResult.data || []).map((event: any) => [event.id, {
          id: event.id,
          userId: event.user_id,
          action: event.action,
          entityType: event.entity_type,
          entityId: event.entity_id,
          details: event.details,
          timestamp: event.created_at || event.timestamp,
        }] as const),
      ]).values());
    }

    return NextResponse.json({
      user: {
        id: profileUser.id,
        name: profileUser.name,
        email: profileUser.email,
        phone: profileUser.phone,
        role: profileUser.role,
        isVerified: !!profileUser.isVerified,
        isSuspended: !!profileUser.isSuspended,
        suspensionReason: profileUser.suspensionReason,
        companyName: profileUser.companyName,
        licenseNumber: profileUser.licenseNumber,
        commercialRegistrationNo: profileUser.commercialRegistrationNo,
        nationalId: profileUser.nationalId,
        bio: profileUser.bio,
        whatsappEnabled: profileUser.whatsappEnabled ?? true,
        createdAt: profileUser.createdAt,
      },
      properties,
      inquiriesSent,
      inquiriesReceived,
      reports,
      auditLogs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب بيانات المستخدم";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    await resolveTargetUser(params.id);

    const body = await req.json();
    const {
      isSuspended,
      reason,
      role: newRole,
      roleReason,
      isVerified,
      verificationReason,
      name,
      phone,
      companyName,
      licenseNumber,
      bio,
    } = body;

    let updatedUser = null;

    if (
      name !== undefined ||
      phone !== undefined ||
      companyName !== undefined ||
      licenseNumber !== undefined ||
      bio !== undefined
    ) {
      updatedUser = dbStore.updateUserProfile(params.id, {
        name,
        phone,
        companyName,
        licenseNumber,
        bio,
      });
    }

    if (newRole) {
      if (!["seeker", "buyer", "owner", "broker", "admin"].includes(newRole)) {
        return NextResponse.json({ error: "الدور المختار غير صالح" }, { status: 400 });
      }
      if (!roleReason || !roleReason.trim()) {
        return NextResponse.json({ error: "سبب تغيير الدور إلزامي للتدقيق الإداري والأمني" }, { status: 400 });
      }
      updatedUser = dbStore.changeUserRole(params.id, newRole, user, roleReason);
    }

    if (typeof isVerified === "boolean") {
      updatedUser = dbStore.verifyBrokerOrUser(params.id, isVerified, user, verificationReason || reason);
    }

    if (typeof isSuspended === "boolean") {
      updatedUser = dbStore.suspendUser(params.id, isSuspended, user, reason);
    }

    if (!updatedUser) {
      return NextResponse.json({ error: "لم يتم تحديد أي إجراء لتحديث المستخدم" }, { status: 400 });
    }

    // Cloud synchronization if UUID exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    if (isUuid) {
      try {
        const supabase = createSupabaseServerClient();
        const supaUpdatePayload: Record<string, unknown> = {};
        if (newRole) supaUpdatePayload.role = newRole;
        if (typeof isVerified === "boolean") supaUpdatePayload.is_verified = isVerified;
        if (name !== undefined) supaUpdatePayload.full_name = updatedUser.name;
        if (phone !== undefined) supaUpdatePayload.phone = updatedUser.phone;
        if (companyName !== undefined) supaUpdatePayload.company_name = updatedUser.companyName;
        if (licenseNumber !== undefined) supaUpdatePayload.license_number = updatedUser.licenseNumber;
        if (Object.keys(supaUpdatePayload).length > 0) {
          await supabase.from("profiles").update(supaUpdatePayload).eq("id", params.id);
        }
      } catch (e) {
        console.warn("[AdminUsers] Cloud sync notice:", e);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isVerified: !!updatedUser.isVerified,
        isSuspended: !!updatedUser.isSuspended,
        suspensionReason: updatedUser.suspensionReason,
        companyName: updatedUser.companyName,
        licenseNumber: updatedUser.licenseNumber,
      },
      message: "تم تحديث بيانات وحالة المستخدم بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث حالة المستخدم";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
