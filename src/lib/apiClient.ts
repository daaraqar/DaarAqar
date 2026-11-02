/**
 * Unified API Client for Web and Capacitor Mobile (Android / iOS)
 * Automatically detects Capacitor WebView and prefixes relative /api/ routes
 * with the production/configured API Base URL to prevent localhost network failures.
 */

/**
 * Returns the configured API Base URL from environment variables or falls back to production.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // Fallback to production platform URL
  return "https://aqarpulse.eg";
}

/**
 * Detects whether the code is currently running inside a Capacitor Native WebView.
 */
export function isCapacitorPlatform(): boolean {
  if (typeof window === "undefined") return false;

  const win = window as any;

  // 1. Direct Capacitor runtime check
  if (typeof win.Capacitor !== "undefined") {
    if (typeof win.Capacitor.isNativePlatform === "function" && win.Capacitor.isNativePlatform()) {
      return true;
    }
    if (typeof win.Capacitor.getPlatform === "function" && win.Capacitor.getPlatform() !== "web") {
      return true;
    }
  }

  // 2. Protocol check: Capacitor loads from capacitor:// on iOS/Android or http(s)://localhost in WebView
  const protocol = window.location.protocol || "";
  const origin = window.location.origin || "";

  if (protocol === "capacitor:" || protocol === "ionic:" || origin.startsWith("capacitor://") || origin.startsWith("ionic://")) {
    return true;
  }

  // 3. Android WebView localhost asset serving (typically port 80/empty without standard Next.js 3000 port)
  if (
    (origin === "https://localhost" || origin === "http://localhost") &&
    window.location.port !== "3000" &&
    window.location.port !== "3001"
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves any relative API path into a complete absolute URL when running in Capacitor,
 * or returns standard normalized path in standard web browser.
 */
export function resolveApiUrl(path: string): string {
  if (!path) return "";

  // Already an absolute HTTP/HTTPS URL
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // When inside Capacitor mobile WebView, relative URLs resolve to localhost internally,
  // which will fail. We must prepend the full API Base URL.
  if (isCapacitorPlatform()) {
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}${normalizedPath}`;
  }

  // Server-side rendering (SSR in Node.js)
  if (typeof window === "undefined") {
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}${normalizedPath}`;
  }

  // In standard browser environment, return normalized relative path
  return normalizedPath;
}

import { getStoredAuthTokenSync } from "@/lib/auth/mobileAuthStorage";

/**
 * Enhanced fetch wrapper that automatically routes API calls to the proper Base URL,
 * injects Authorization Bearer tokens for mobile/persistent sessions, and includes credentials.
 */
export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  let targetUrl: string | URL | Request = input;

  if (typeof input === "string") {
    targetUrl = resolveApiUrl(input);
  } else if (input instanceof URL) {
    targetUrl = resolveApiUrl(input.pathname + input.search);
  }

  const headers = new Headers(init?.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Prevent mobile WebView and browser engines from caching stale API responses
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  if (!headers.has("Pragma")) {
    headers.set("Pragma", "no-cache");
  }
  if (!headers.has("Expires")) {
    headers.set("Expires", "0");
  }

  // Inject Authorization Bearer token for mobile sessions if not explicitly provided
  if (!headers.has("Authorization")) {
    const token = getStoredAuthTokenSync();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const requestOptions: RequestInit = {
    cache: "no-store",
    ...init,
    credentials: init?.credentials || "include",
    headers,
  };

  let res = await fetch(targetUrl, requestOptions);

  // 401 Silent Token Refresh Guard (1 single retry attempt)
  if (
    res.status === 401 &&
    !(init as any)?._isRetry &&
    typeof window !== "undefined"
  ) {
    try {
      const { createClient: createSupabaseClient } = await import("@/utils/supabase/client");
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (!error && data?.session?.access_token) {
        const freshToken = data.session.access_token;
        const { setStoredAuthToken } = await import("@/lib/auth/mobileAuthStorage");
        await setStoredAuthToken(freshToken);

        const retryHeaders = new Headers(requestOptions.headers);
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);

        const retryOptions: RequestInit & { _isRetry?: boolean } = {
          ...requestOptions,
          headers: retryHeaders,
          _isRetry: true,
        };

        res = await fetch(targetUrl, retryOptions);
      }
    } catch (refreshErr) {
      console.warn("[apiFetch] Silent token refresh on 401 failed:", refreshErr);
    }
  }

  return res;
}

/**
 * Unified API Client Helper
 */
export const apiClient = {
  resolveUrl: resolveApiUrl,
  isMobile: isCapacitorPlatform,
  getBaseUrl: getApiBaseUrl,

  get: (url: string, init?: RequestInit) => apiFetch(url, { cache: "no-store", ...init, method: "GET" }),

  post: (url: string, body?: any, init?: RequestInit) =>
    apiFetch(url, {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  put: (url: string, body?: any, init?: RequestInit) =>
    apiFetch(url, {
      ...init,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  patch: (url: string, body?: any, init?: RequestInit) =>
    apiFetch(url, {
      ...init,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  delete: (url: string, init?: RequestInit) => apiFetch(url, { ...init, method: "DELETE" }),
};
