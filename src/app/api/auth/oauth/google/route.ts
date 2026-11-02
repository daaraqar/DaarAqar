import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const redirectParam = searchParams.get("redirect") || "/dashboard";
    const roleParam = searchParams.get("role") || "seeker";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json(
        { enabled: false, error: "Supabase URL not configured" },
        { status: 400 }
      );
    }

    const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=google`;

    // Server-side probe to check if Google provider is enabled in Supabase Auth
    const probe = await fetch(authorizeUrl, {
      method: "GET",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
      },
      redirect: "manual",
    });

    if (probe.status === 400) {
      return NextResponse.json({
        enabled: false,
        error: "provider_not_enabled",
        message: "تسجيل الدخول عبر Google غير مفعّل حالياً في لوحة تحكم Supabase.",
        solution: "يتطلب تفعيل Google Provider إدخال Google Client ID و Client Secret في Supabase Auth Providers.",
      });
    }

    // Google provider is enabled! Construct full redirect URL
    const origin = new URL(req.url).origin;
    const callbackUrl = `${origin}/api/auth/callback?redirect=${encodeURIComponent(redirectParam)}&role=${encodeURIComponent(roleParam)}`;
    const fullAuthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callbackUrl)}`;

    return NextResponse.json({
      enabled: true,
      url: fullAuthUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { enabled: false, error: error.message || "فشل التحقق من موفر Google" },
      { status: 500 }
    );
  }
}
