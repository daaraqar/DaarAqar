import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { normalizeEmail, isValidEmail } from "@/lib/auth/security";
import {
  ADMIN_PERMISSION_IDS,
  canGrantAdminPermissions,
  hasAdminPermission,
  hasUnrestrictedAdminAccess,
} from "@/lib/auth/admin-permissions";
import { createAdminClient } from "@/utils/supabase/server";

function hasCentralCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !/placeholder|your[-_]/i.test(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !/placeholder|your[-_]/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    if (!hasCentralCredentials()) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "قاعدة البيانات المركزية غير مهيأة لإدارة الموظفين" }, { status: 503 });
      }
      const localStaff = dbStore.getAllUsersForAdmin()
        .filter((member) => member.role === "admin" && member.isStaff)
        .map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email || "",
          phone: member.phone,
          role: member.role,
          adminRole: member.adminRole || "moderator",
          adminPermissions: member.adminPermissions || [],
          isStaff: Boolean(member.isStaff),
          isSuspended: Boolean(member.isSuspended),
          createdAt: member.createdAt,
        }));
      return NextResponse.json({ staff: localStaff });
    }

    const supabase = createAdminClient();
    const { data: staffProfiles, error } = await supabase
      .from("profiles")
      .select("*")
      .or("role.eq.admin,is_staff.eq.true")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching staff profiles:", error);
      return NextResponse.json({ error: "تعذر تحميل قائمة الموظفين من قاعدة البيانات المركزية" }, { status: 503 });
    }

    const staff = staffProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      adminRole: p.admin_role || (
        p.role === "admin" && !p.is_staff && !Array.isArray(p.admin_permissions)
          ? "superadmin"
          : "moderator"
      ),
      adminPermissions: Array.isArray(p.admin_permissions)
        ? p.admin_permissions
        : [],
      isStaff: Boolean(p.is_staff),
      isSuspended: Boolean(p.is_suspended),
      createdAt: p.created_at,
    }));

    return NextResponse.json({ staff });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب قائمة الموظفين";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول أولاً" }, { status: 401 });
    }
    if (!hasAdminPermission(currentUser, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية الإدارة العليا" }, { status: 403 });
    }

    const body = await req.json();
    const { name: requestedName, email: rawEmail } = body;

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ error: "بريد إلكتروني صالح للموظف مطلوب" }, { status: 400 });
    }

    const email = normalizeEmail(rawEmail);
    const name = typeof requestedName === "string" && requestedName.trim()
      ? requestedName.trim()
      : email.split("@")[0].replace(/[._-]+/g, " ");
    const allowedRoles = ["moderator", "support_agent", "content_editor", "superadmin"] as const;
    const requestedRole: unknown = body.adminRole ?? "moderator";
    if (
      typeof requestedRole !== "string" ||
      !allowedRoles.includes(requestedRole as (typeof allowedRoles)[number])
    ) {
      return NextResponse.json({ error: "الدور الوظيفي للموظف غير صالح" }, { status: 400 });
    }
    const adminRole = requestedRole as (typeof allowedRoles)[number];
    const submittedPermissions: unknown[] = Array.isArray(body.adminPermissions) ? body.adminPermissions : [];
    if (submittedPermissions.some((permission) =>
      typeof permission !== "string" ||
      !ADMIN_PERMISSION_IDS.includes(permission as (typeof ADMIN_PERMISSION_IDS)[number])
    )) {
      return NextResponse.json({ error: "تحتوي قائمة الصلاحيات على صلاحية غير مدعومة" }, { status: 400 });
    }
    const adminPermissions = Array.from(new Set(submittedPermissions as string[]));
    if (!canGrantAdminPermissions(currentUser, adminPermissions)) {
      return NextResponse.json({ error: "لا يمكنك منح صلاحيات غير موجودة في حسابك" }, { status: 403 });
    }
    if (
      adminRole === "superadmin" &&
      !hasUnrestrictedAdminAccess(currentUser)
    ) {
      return NextResponse.json({ error: "إنشاء مدير بصلاحيات كاملة يتطلب صلاحية المدير الأعلى" }, { status: 403 });
    }

    let targetUserId: string;
    if (hasCentralCredentials()) {
      const supabase = createAdminClient();
      const { data: existingProfile, error: profileReadError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (profileReadError) {
        return NextResponse.json({ error: `تعذر التحقق من البريد: ${profileReadError.message}` }, { status: 503 });
      }
      if (email === "mkelwayzy@gmail.com") {
        return NextResponse.json({ error: "لا يمكن تعديل صلاحيات مالك المنصة الرئيسي من هذا النموذج" }, { status: 400 });
      }

      targetUserId = existingProfile?.id;
      if (!targetUserId) {
        let authUser: { id: string; email?: string } | null = null;
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
          email,
          user_metadata: { full_name: name },
        });
        if (createError) {
          if (createError.code !== "email_exists" && createError.status !== 422) {
            return NextResponse.json({ error: createError.message || "تعذر إنشاء حساب الدخول للموظف" }, { status: 400 });
          }
          for (let page = 1; ; page += 1) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) throw error;
            authUser = data.users.find(
              (candidate) => candidate.email && normalizeEmail(candidate.email) === email
            ) || null;
            if (authUser || data.users.length < 1000) break;
          }
          if (!authUser) {
            return NextResponse.json({ error: "يوجد حساب بهذا البريد لكن تعذر العثور عليه لربط صلاحيات الموظف" }, { status: 409 });
          }
        } else {
          authUser = created.user;
        }
        if (!authUser) {
          return NextResponse.json({ error: "تعذر إنشاء حساب الدخول للموظف" }, { status: 400 });
        }
        targetUserId = authUser.id;
      }

      const { error: profileWriteError } = await supabase.from("profiles").upsert({
        id: targetUserId,
        name,
        email,
        role: "admin",
        admin_role: adminRole,
        admin_permissions: adminPermissions,
        is_staff: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (profileWriteError) {
        return NextResponse.json({ error: `تعذر حفظ صلاحيات الموظف: ${profileWriteError.message}` }, { status: 500 });
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "قاعدة البيانات المركزية غير مهيأة لإضافة الموظفين" }, { status: 503 });
      }
      const existingUser = dbStore.findUserByEmail(email);
      targetUserId = existingUser?.id || crypto.randomUUID();
    }

    const staffUser = dbStore.ensureUser({
      id: targetUserId,
      name,
      email,
      phone: dbStore.findUserById(targetUserId)?.phone || "",
      role: "admin",
      adminRole,
      adminPermissions,
      isStaff: true,
      isVerified: dbStore.findUserById(targetUserId)?.isVerified || false,
      createdAt: new Date().toISOString(),
    });

    dbStore.recordAuditEvent(currentUser.id, "STAFF_MEMBER_CREATED", "admin", targetUserId, {
      createdStaffEmail: email,
      adminRole,
      permissionsCount: adminPermissions.length,
    });

    return NextResponse.json({
      success: true,
      message: `تمت إضافة الموظف (${email})، ويمكنه تسجيل الدخول باستخدام رمز OTP المرسل إلى بريده`,
      staff: staffUser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء إضافة الموظف";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
