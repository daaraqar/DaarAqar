import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";
import {
  isValidDisplayName,
  isValidEmail,
  normalizeEmail,
  verifyOtpCode,
  verifySignedOtpTicket,
  getSafeRedirectUrl,
} from "@/lib/auth/security";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const SUPABASE_USERS_PAGE_SIZE = 1000;

async function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("placeholder")) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey.includes("placeholder")) {
    throw new Error("إعدادات المصادقة غير مكتملة: يلزم ضبط SUPABASE_SERVICE_ROLE_KEY على الخادم");
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SupabaseAdminClient = NonNullable<Awaited<ReturnType<typeof createSupabaseAdminClient>>>;
type SupabaseAuthUser = NonNullable<
  Awaited<ReturnType<SupabaseAdminClient["auth"]["admin"]["getUserById"]>>["data"]["user"]
>;

async function findSupabaseAuthUserByEmail(
  supabase: SupabaseAdminClient,
  email: string
): Promise<SupabaseAuthUser | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: SUPABASE_USERS_PAGE_SIZE,
    });
    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email && normalizeEmail(candidate.email) === email
    );
    if (user) return user;
    if (data.users.length < SUPABASE_USERS_PAGE_SIZE) return null;
  }
}

async function ensureSupabaseAuthUser(
  supabase: SupabaseAdminClient,
  email: string,
  name: string,
  userId?: string
): Promise<SupabaseAuthUser> {
  if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data.user?.email && normalizeEmail(data.user.email) === email) {
      return data.user;
    }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });
  if (!error && data.user) return data.user;

  const isExistingUser =
    error?.status === 422 ||
    error?.code === "email_exists" ||
    /already (?:registered|exists)/i.test(error?.message || "");
  if (!isExistingUser) {
    throw error || new Error("تعذر إنشاء حساب المصادقة");
  }

  const existingUser = await findSupabaseAuthUserByEmail(supabase, email);
  if (!existingUser) {
    throw new Error("تعذر العثور على حساب المصادقة المرتبط بهذا البريد الإلكتروني");
  }

  if (!existingUser.email_confirmed_at) {
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { email_confirm: true }
    );
    if (updateError) throw updateError;
    if (updated.user) return updated.user;
  }

  return existingUser;
}

async function createSupabaseProfile(
  supabase: SupabaseAdminClient,
  user: User,
  email: string
) {
  const authUser = await ensureSupabaseAuthUser(supabase, email, user.name, user.id);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        name: user.name,
        email,
        phone: user.phone || null,
        role: user.role,
        is_verified: false,
        created_at: authUser.created_at || user.createdAt,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      code,
      name: requestedName,
      ticket: bodyTicket,
      redirect: rawRedirect,
      rememberMe = true,
      isAdminLogin,
    } = body;

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json({ error: "البريد الإلكتروني غير صالح" }, { status: 400 });
    }

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json({ error: "يرجى إدخال رمز التحقق المكون من 6 أرقام" }, { status: 400 });
    }

    const cleanEmail = normalizeEmail(email);

    // Read ticket from body or cookies
    const cookieHeader = req.headers.get("cookie") || "";
    const ticketFromCookie = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("aqarpulse_otp_ticket="))
      ?.split("=")[1];
    const ticket = bodyTicket || ticketFromCookie;

    let isCodeValid = false;
    let failureReason: string | undefined;

    // Method 1: Cryptographically signed ticket (stateless across Vercel / serverless instances)
    if (ticket) {
      const ticketResult = verifySignedOtpTicket(cleanEmail, code, decodeURIComponent(ticket));
      if (ticketResult.valid) {
        isCodeValid = true;
      } else {
        failureReason = ticketResult.reason;
      }
    }

    // Method 2: Fallback to local store / persistent disk tokens
    if (!isCodeValid) {
      const storeResult = verifyOtpCode(cleanEmail, code);
      if (storeResult.valid) {
        isCodeValid = true;
      } else if (!failureReason) {
        failureReason = storeResult.reason;
      }
    }

    if (!isCodeValid) {
      return NextResponse.json(
        { error: failureReason || "رمز التحقق غير صحيح أو انتهت صلاحيته" },
        { status: 400 }
      );
    }

    const supabaseAdmin = await createSupabaseAdminClient();
    let centralProfile = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .ilike("email", cleanEmail)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      centralProfile = data;
    }

    let user = dbStore.findUserByEmail(cleanEmail);
    let isNewAccount = !user && !centralProfile;

    if (isNewAccount && !isAdminLogin && !isValidDisplayName(requestedName)) {
      return NextResponse.json(
        {
          requiresName: true,
          error: "أدخل اسمك الكامل ليظهر في ملفك الشخصي وعند إرسال الرسائل.",
        },
        { status: 400 }
      );
    }

    if (centralProfile) {
      user = dbStore.ensureUser({
        id: centralProfile.id,
        name: centralProfile.name || user?.name || cleanEmail.split("@")[0],
        email: centralProfile.email || cleanEmail,
        phone: centralProfile.phone || user?.phone || "",
        role: centralProfile.role || user?.role || "seeker",
        isVerified: centralProfile.is_verified ?? user?.isVerified ?? false,
        isSuspended: Boolean(centralProfile.is_suspended),
        companyName: centralProfile.company_name || user?.companyName,
        licenseNumber: centralProfile.license_number || user?.licenseNumber,
        adminRole: centralProfile.admin_role || (
          centralProfile.role === "admin" &&
          !centralProfile.is_staff &&
          !Array.isArray(centralProfile.admin_permissions)
            ? "superadmin"
            : undefined
        ),
        adminPermissions: Array.isArray(centralProfile.admin_permissions)
          ? centralProfile.admin_permissions
          : [],
        isStaff: Boolean(centralProfile.is_staff),
        createdAt: centralProfile.created_at || user?.createdAt || new Date().toISOString(),
      });
    }

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        name: isValidDisplayName(requestedName)
          ? requestedName.trim()
          : cleanEmail.split("@")[0],
        email: cleanEmail,
        phone: "",
        role: "seeker",
        isVerified: false,
        createdAt: new Date().toISOString(),
      };
    }

    if (user.isSuspended) {
      return NextResponse.json(
        { error: `تم تعليق هذا الحساب: ${user.suspensionReason || "يرجى مراجعة إدارة المنصة"}` },
        { status: 403 }
      );
    }

    if (isAdminLogin) {
      const isMasterAdmin = cleanEmail.toLowerCase() === "mkelwayzy@gmail.com";
      const isExistingStaffOrAdmin = user.role === "admin" || (user as any).isStaff === true;

      if (!isMasterAdmin && !isExistingStaffOrAdmin) {
        return NextResponse.json(
          {
            error: "عذراً، هذا البريد غير مصرح له بالدخول كإدارة. الدخول مخصص للمشرف العام (MKELWAYZY@gmail.com) أو موظفي الإدارة المعتمدين.",
          },
          { status: 403 }
        );
      }

      user.role = "admin";
      try {
        dbStore.updateUser(user.id, { role: "admin" });
      } catch {
        // Fallback safe
      }
    }

    if (supabaseAdmin && centralProfile && isAdminLogin && centralProfile.role !== "admin") {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ role: "admin", is_staff: true })
        .eq("id", centralProfile.id)
        .select("*")
        .single();
      if (error) throw error;
      centralProfile = data;
    }

    if (supabaseAdmin && !centralProfile) {
      centralProfile = await createSupabaseProfile(supabaseAdmin, user, cleanEmail);
      user = {
        ...user,
        id: centralProfile.id,
        name: centralProfile.name || user.name,
        email: centralProfile.email || cleanEmail,
        phone: centralProfile.phone || user.phone,
        role: centralProfile.role || user.role,
        isVerified: centralProfile.is_verified ?? user.isVerified,
        isSuspended: Boolean(centralProfile.is_suspended),
        companyName: centralProfile.company_name || user.companyName,
        licenseNumber: centralProfile.license_number || user.licenseNumber,
        adminRole: centralProfile.admin_role || user.adminRole,
        adminPermissions: centralProfile.admin_permissions || user.adminPermissions,
        isStaff: Boolean(centralProfile.is_staff),
        createdAt: centralProfile.created_at || user.createdAt,
      };
    }

    if (isNewAccount) {
      user = dbStore.ensureUser(user);
      dbStore.recordAuditEvent(user.id, "USER_AUTO_REGISTERED_BY_EMAIL", "auth", cleanEmail, {
        ip: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      });
    }

    // Audit login
    dbStore.recordAuditEvent(user.id, "USER_LOGIN_SUCCESS_EMAIL_OTP", "auth", cleanEmail, {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      isAdminLogin: Boolean(isAdminLogin),
    });

    const defaultRedirect = (user.role === "admin" || isAdminLogin) ? "/admin" : "/";
    const safeRedirect = getSafeRedirectUrl(rawRedirect, defaultRedirect);
    const token = createSessionToken(user);

    const response = NextResponse.json({
      success: true,
      user,
      redirectTo: safeRedirect,
      token,
      isNewAccount,
    });

    const proto = req.headers.get("x-forwarded-proto") || "";
    const isHttps =
      proto.toLowerCase() === "https" ||
      req.headers.get("x-forwarded-ssl") === "on" ||
      req.url.startsWith("https://");
    const isSecure = isHttps;

    const maxAgeSeconds = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    response.cookies.delete("aqarpulse_otp_ticket");

    return response;
  } catch (err: any) {
    console.error("[EmailOtpVerify] Error:", err);
    return NextResponse.json(
      { error: err?.message || "حدث خطأ أثناء تأكيد رمز التحقق" },
      { status: 500 }
    );
  }
}
