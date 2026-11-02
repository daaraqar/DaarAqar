import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://aqarpulse.eg",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.startsWith("capacitor://") || origin.startsWith("ionic://")) return true;
  if (origin.endsWith(".aqarpulse.eg") || origin === "https://aqarpulse.eg") return true;
  if (process.env.NEXT_PUBLIC_APP_URL && origin === process.env.NEXT_PUBLIC_APP_URL) return true;
  if (process.env.NEXT_PUBLIC_SITE_URL && origin === process.env.NEXT_PUBLIC_SITE_URL) return true;
  if (process.env.NEXT_PUBLIC_API_URL && origin === process.env.NEXT_PUBLIC_API_URL) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle CORS Preflight for Capacitor WebView & Mobile Clients
  if (request.method === "OPTIONS") {
    const allowOrigin = isOriginAllowed(origin) ? origin! : (origin || "*");
    const preflightHeaders = new Headers({
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, apikey, x-client-info",
      "Access-Control-Max-Age": "86400",
    });
    return new NextResponse(null, { status: 204, headers: preflightHeaders });
  }

  const response = await updateSession(request);

  // Attach CORS headers to normal requests from allowed origins
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, apikey, x-client-info"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images / static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
