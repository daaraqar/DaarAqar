import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Polyfill WebSocket in Node.js 20 runtime to prevent @supabase/realtime-js initialization crash
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class DummyWebSocket {} as unknown as typeof WebSocket;
}

export function isCentralSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("placeholder") &&
      !key.includes("placeholder")
  );
}

export const createClient = (
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
  authToken?: string
) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )!;

  let store: Awaited<ReturnType<typeof cookies>> | undefined;
  try {
    store = cookieStore ?? cookies();
  } catch {
    // In contexts where cookies() is not available
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return store ? store.getAll() : [];
        },
        setAll(cookiesToSet) {
          try {
            if (store) {
              cookiesToSet.forEach(({ name, value, options }) => store!.set(name, value, options));
            }
          } catch {
            // Ignored in Server Components
          }
        },
      },
      global: (() => {
        if (!authToken) return undefined;
        const clean = authToken.replace(/^Bearer\s+/i, "").trim();
        // Strictly only pass genuine 3-part JWTs (header.payload.signature) to Supabase
        if (clean.split(".").length === 3) {
          return {
            headers: {
              Authorization: `Bearer ${clean}`,
            },
          };
        }
        return undefined;
      })(),
    },
  );
};

export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    /placeholder|your[-_]/i.test(url) ||
    !serviceKey ||
    /placeholder|your[-_]/i.test(serviceKey)
  ) {
    throw new Error(
      "إعدادات قاعدة البيانات الإدارية غير مكتملة: يلزم ضبط NEXT_PUBLIC_SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY على الخادم"
    );
  }

  return createServerClient(url, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
};
