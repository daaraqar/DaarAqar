import { createClient } from "./client";

/**
 * Starts a Google/Facebook OAuth flow.
 *
 * The redirectTo URL is intentionally CLEAN (no query string) so it matches the
 * Supabase "Redirect URLs" allow-list exactly. If it doesn't match, Supabase silently
 * falls back to the Site URL (http://localhost:3000) — which was the original bug.
 * Post-login redirect and role are carried in short-lived cookies instead.
 */
export async function startOAuth(
  provider: "google" | "facebook",
  opts: { redirect?: string; role?: string } = {},
) {
  const origin = window.location.origin;
  const maxAge = 600;
  document.cookie = `oauth_redirect=${encodeURIComponent(opts.redirect || "/dashboard")}; path=/; max-age=${maxAge}; samesite=lax`;
  document.cookie = `oauth_role=${encodeURIComponent(opts.role || "seeker")}; path=/; max-age=${maxAge}; samesite=lax`;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      skipBrowserRedirect: true,
      queryParams:
        provider === "google" ? { access_type: "offline", prompt: "select_account" } : undefined,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("تعذر الحصول على رابط المصادقة");
  window.location.href = data.url;
}
