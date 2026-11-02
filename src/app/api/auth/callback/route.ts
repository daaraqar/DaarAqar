import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { getSafeRedirectUrl } from "@/lib/auth/security";

export const dynamic = "force-dynamic";

/**
 * GET Handler for Supabase OAuth PKCE callback & Hash Bridge
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieHeader = request.headers.get("cookie") || "";
  const readCookie = (n: string) => {
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${n}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  const rawRedirect = searchParams.get("redirect") || readCookie("oauth_redirect") || "/dashboard";
  const safeRedirect = getSafeRedirectUrl(rawRedirect, "/dashboard");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // If OAuth provider returned an explicit error (e.g., user clicked Cancel in Google)
  if (oauthError) {
    console.warn("[OAuthCallback] Provider returned error:", oauthError, errorDescription);
    const redirectUrl = new URL(`/login?error=${encodeURIComponent(oauthError)}`, origin).toString();
    return NextResponse.redirect(redirectUrl);
  }

  // 1. Standard PKCE Flow with authorization code
  if (code) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[OAuthCallback] exchangeCodeForSession error:", error.message);
      } else if (data?.user) {
        const supaUser = data.user;
        const roleFromQuery = searchParams.get("role") || readCookie("oauth_role");
        const assignedRole = (roleFromQuery || supaUser.user_metadata?.role || "seeker") as any;

        const profileUser = dbStore.ensureUser({
          id: supaUser.id,
          name:
            supaUser.user_metadata?.full_name ||
            supaUser.user_metadata?.name ||
            supaUser.email?.split("@")[0] ||
            "مستخدم عقار",
          email: supaUser.email,
          phone: supaUser.user_metadata?.phone || supaUser.phone || "+201000000000",
          role: assignedRole,
          avatarUrl: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture,
          isVerified: false,
          emailVerified: Boolean(supaUser.email_confirmed_at || supaUser.email),
          phoneVerified: Boolean(supaUser.phone_confirmed_at),
          createdAt: supaUser.created_at || new Date().toISOString(),
        });

        const token = createSessionToken(profileUser);
        const redirectUrl = new URL(safeRedirect, origin).toString();
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set({ name: "oauth_redirect", value: "", path: "/", maxAge: 0 });
        response.cookies.set({ name: "oauth_role", value: "", path: "/", maxAge: 0 });

        const proto = request.headers.get("x-forwarded-proto");
        const isHttps = proto === "https" || request.url.startsWith("https://");
        const isSecure = process.env.NODE_ENV === "production" && isHttps;

        response.cookies.set({
          name: SESSION_COOKIE_NAME,
          value: token,
          httpOnly: true,
          secure: isSecure,
          path: "/",
          maxAge: 30 * 24 * 60 * 60, // 30 days for OAuth sign-ins
          sameSite: "lax",
        });

        return response;
      }
    } catch (err) {
      console.error("[OAuthCallback] Unexpected error completing code exchange:", err);
    }
  }

  // 2. Hash Fragment Bridge (For Implicit Flow or cases where tokens were appended to hash)
  // Browsers strip URL fragments (#access_token=...) before HTTP requests reach the server.
  // This lightweight bridge script reads window.location.hash in the client and calls POST /api/auth/callback.
  const bridgeHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>جاري إتمام تسجيل الدخول...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); text-align: center; max-width: 400px; width: 90%; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #059669; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3 style="margin:0 0 0.5rem;font-size:1.1rem;">جاري توثيق الدخول عبر الحساب...</h3>
    <p style="margin:0;font-size:0.85rem;color:#64748b;">يرجى الانتظار بضع ثوانٍ لتحويلك إلى حسابك</p>
  </div>
  <script>
    (async function() {
      try {
        const hash = window.location.hash ? window.location.hash.substring(1) : "";
        const search = window.location.search ? window.location.search.substring(1) : "";
        const params = new URLSearchParams(hash || search);
        
        const accessToken = params.get("access_token");
        const error = params.get("error");
        const errorDesc = params.get("error_description");
        const role = new URLSearchParams(search).get("role") || "seeker";
        const redirect = new URLSearchParams(search).get("redirect") || "/dashboard";

        if (error) {
          window.location.href = "/login?error=" + encodeURIComponent(error);
          return;
        }

        if (accessToken) {
          const res = await fetch("/api/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, role, redirect })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            window.location.href = data.redirect || "/dashboard";
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      // If no valid tokens found in hash or exchange failed, fallback to login
      window.location.href = "/login?error=oauth_failed";
    })();
  </script>
</body>
</html>`;

  return new NextResponse(bridgeHtml, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * POST Handler for completing OAuth session from client-side token (Implicit Flow)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accessToken, role, redirect } = body;
    const safeRedirect = getSafeRedirectUrl(redirect || "/dashboard", "/dashboard");

    if (!accessToken) {
      return NextResponse.json({ error: "No access token provided" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      console.error("[OAuthCallback POST] Invalid access token:", error?.message);
      return NextResponse.json({ error: error?.message || "Invalid session token" }, { status: 401 });
    }

    const supaUser = data.user;
    const assignedRole = (role || supaUser.user_metadata?.role || "seeker") as any;

    const profileUser = dbStore.ensureUser({
      id: supaUser.id,
      name:
        supaUser.user_metadata?.full_name ||
        supaUser.user_metadata?.name ||
        supaUser.email?.split("@")[0] ||
        "مستخدم عقار",
      email: supaUser.email,
      phone: supaUser.user_metadata?.phone || supaUser.phone || "+201000000000",
      role: assignedRole,
      avatarUrl: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture,
      isVerified: false,
      emailVerified: Boolean(supaUser.email_confirmed_at || supaUser.email),
      phoneVerified: Boolean(supaUser.phone_confirmed_at),
      createdAt: supaUser.created_at || new Date().toISOString(),
    });

    const token = createSessionToken(profileUser);
    const response = NextResponse.json({
      success: true,
      redirect: safeRedirect,
      user: profileUser,
    });

    const proto = request.headers.get("x-forwarded-proto");
    const isHttps = proto === "https" || request.url.startsWith("https://");
    const isSecure = process.env.NODE_ENV === "production" && isHttps;

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    console.error("[OAuthCallback POST] Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to process OAuth session" }, { status: 500 });
  }
}
