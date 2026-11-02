import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import {
  ADMIN_PERMISSION_IDS,
  canGrantAdminPermissions,
  hasAdminPermission,
  hasUnrestrictedAdminAccess,
} from "@/lib/auth/admin-permissions";
import { createAdminClient } from "@/utils/supabase/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول أولاً" }, { status: 401 });
    }
    if (!hasAdminPermission(currentUser, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية الإدارة العليا" }, { status: 403 });
    }

    const targetStaffId = params.id;
    const body = await req.json();
    const {
      adminRole,
      adminPermissions,
      isSuspended,
      name,
      phone,
    } = body;

    if (adminPermissions !== undefined) {
      if (!Array.isArray(adminPermissions) || adminPermissions.some((permission: unknown) =>
        typeof permission !== "string" ||
        !ADMIN_PERMISSION_IDS.includes(permission as (typeof ADMIN_PERMISSION_IDS)[number])
      )) {
        return NextResponse.json({ error: "قائمة صلاحيات الموظف غير صالحة" }, { status: 400 });
      }
      if (!canGrantAdminPermissions(currentUser, adminPermissions)) {
        return NextResponse.json({ error: "لا يمكنك منح صلاحيات غير موجودة في حسابك" }, { status: 403 });
      }
    }
    if (
      adminRole === "superadmin" &&
      !hasUnrestrictedAdminAccess(currentUser)
    ) {
      return NextResponse.json({ error: "منح صلاحيات المدير الأعلى يتطلب صلاحية المدير الأعلى" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // 1. Fetch current profile
    const { data: targetProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetStaffId)
      .single();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });
    }

    // Protection: Prevent suspending the primary owner
    if (targetProfile.email === "mkelwayzy@gmail.com" && isSuspended === true) {
      return NextResponse.json(
        { error: "لا يمكن تعليق أو تعطيل حساب مالك المنصة الرئيسي" },
        { status: 400 }
      );
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (adminRole !== undefined) updates.admin_role = adminRole;
    if (adminPermissions !== undefined) updates.admin_permissions = adminPermissions;
    if (isSuspended !== undefined) updates.is_suspended = isSuspended;
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();

    // 2. Update profile
    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", targetStaffId);

    if (updateErr) {
      return NextResponse.json({ error: "فشل تحديث بيانات الموظف في قاعدة البيانات" }, { status: 500 });
    }

    if (dbStore.findUserById(targetStaffId)) {
      dbStore.updateUser(targetStaffId, {
        ...(adminRole !== undefined ? { adminRole } : {}),
        ...(adminPermissions !== undefined ? { adminPermissions } : {}),
        ...(isSuspended !== undefined ? { isSuspended } : {}),
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone.trim() } : {}),
      });
    }

    dbStore.recordAuditEvent(currentUser.id, "STAFF_MEMBER_UPDATED", "admin", targetStaffId, {
      targetEmail: targetProfile.email,
      updates,
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث بيانات وصلاحيات الموظف بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تعديل بيانات الموظف";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول أولاً" }, { status: 401 });
    }
    if (!hasAdminPermission(currentUser, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية الإدارة العليا" }, { status: 403 });
    }

    const targetStaffId = params.id;
    const supabase = createAdminClient();

    const { data: targetProfile, error: profileReadError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", targetStaffId)
      .single();
    if (profileReadError || !targetProfile) {
      return NextResponse.json({ error: "الموظف غير موجود في قاعدة البيانات المركزية" }, { status: 404 });
    }

    if (targetProfile?.email === "mkelwayzy@gmail.com") {
      return NextResponse.json(
        { error: "لا يمكن حذف أو إزالة صلاحية مالك المنصة الرئيسي" },
        { status: 400 }
      );
    }

    const { data: publishedProperties, error: propertiesError } = await supabase
      .from("properties")
      .select("advertiser_type")
      .eq("advertiser_id", targetStaffId)
      .in("status", ["active", "published"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (propertiesError) {
      return NextResponse.json({ error: `تعذر تحديد صفة الحساب من مشاريعه المعتمدة: ${propertiesError.message}` }, { status: 503 });
    }
    const publishedType = publishedProperties?.[0]?.advertiser_type;
    const restoredRole = publishedType === "broker" ? "broker" : publishedType === "owner" ? "owner" : "seeker";

    const { error: revokeError } = await supabase
      .from("profiles")
      .update({
        role: restoredRole,
        admin_role: null,
        admin_permissions: [],
        is_staff: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetStaffId);
    if (revokeError) {
      return NextResponse.json({ error: `تعذر إلغاء صلاحيات الموظف: ${revokeError.message}` }, { status: 500 });
    }
    const localStaff = dbStore.findUserById(targetStaffId);
    if (localStaff) {
      dbStore.updateUser(targetStaffId, {
        role: restoredRole,
        adminRole: undefined,
        adminPermissions: [],
        isStaff: false,
      });
    }

    dbStore.recordAuditEvent(currentUser.id, "STAFF_PRIVILEGES_REVOKED", "admin", targetStaffId, {
      revokedEmail: targetProfile?.email,
      revokedBy: currentUser.email,
    });

    return NextResponse.json({
      success: true,
      message: "تم إلغاء صلاحيات الموظف الإدارية بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء إزالة الموظف";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
