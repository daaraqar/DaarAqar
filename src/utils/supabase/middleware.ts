import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase credentials may be absent in local development (local store mode).
 * In that case session refresh is skipped instead of crashing every request.
 */
const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseKey);

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class DummyWebSocket {} as unknown as typeof WebSocket;
}

export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!hasSupabaseCredentials) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  return supabaseResponse;
};

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!hasSupabaseCredentials) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  // Refresh user session if token exists in Supabase (supports both Cookies and Authorization Bearer header)
  try {
    if (supabaseUrl && supabaseKey) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        const bearerToken = authHeader.substring(7).trim();
        await supabase.auth.getUser(bearerToken);
      } else {
        await supabase.auth.getUser();
      }
    }
  } catch (err) {
    // Silently continue so Supabase network timeouts/outages never break application session
  }

  return supabaseResponse;
};
