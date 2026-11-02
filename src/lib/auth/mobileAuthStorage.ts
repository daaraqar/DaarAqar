/**
 * Mobile-Persistent Authentication Storage Adapter
 * Bridges Web LocalStorage and Capacitor Native Preferences (@capacitor/preferences)
 * to guarantee that sessions, JWTs, and refresh tokens are never wiped out by the OS.
 */

import { Preferences } from "@capacitor/preferences";
import { isCapacitorPlatform } from "@/lib/apiClient";

const AUTH_TOKEN_KEY = "aqarpulse_auth_token";
const SUPABASE_AUTH_STORAGE_PREFIX = "sb-auth-token";

// In-memory cache for synchronous reads during hydration
const memoryCache: Record<string, string> = {};

/**
 * Storage adapter implementing Supabase SupportedStorage interface
 * with Capacitor Preferences backing.
 */
export const capacitorStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Check in-memory cache first
    if (memoryCache[key] !== undefined) {
      return memoryCache[key];
    }

    // 2. Try window.localStorage if available
    if (typeof window !== "undefined") {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          memoryCache[key] = val;
          return val;
        }
      } catch {}
    }

    // 3. Fallback to native Capacitor Preferences
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        memoryCache[key] = value;
        return value;
      }
    } catch {}

    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryCache[key] = value;

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }

    try {
      await Preferences.set({ key, value });
    } catch {}
  },

  removeItem: async (key: string): Promise<void> => {
    delete memoryCache[key];

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }

    try {
      await Preferences.remove({ key });
    } catch {}
  },
};

/**
 * Retrieves the stored AqarPulse or Supabase Auth Token.
 */
export async function getStoredAuthToken(): Promise<string | null> {
  // 1. Try memory cache
  if (memoryCache[AUTH_TOKEN_KEY]) {
    return memoryCache[AUTH_TOKEN_KEY];
  }

  // 2. Try localStorage
  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        memoryCache[AUTH_TOKEN_KEY] = token;
        return token;
      }
    } catch {}
  }

  // 3. Try Capacitor Preferences
  try {
    const { value } = await Preferences.get({ key: AUTH_TOKEN_KEY });
    if (value) {
      memoryCache[AUTH_TOKEN_KEY] = value;
      return value;
    }
  } catch {}

  return null;
}

/**
 * Synchronous version for rapid client fetch injection (uses memory or localStorage).
 */
export function getStoredAuthTokenSync(): string | null {
  if (memoryCache[AUTH_TOKEN_KEY]) {
    return memoryCache[AUTH_TOKEN_KEY];
  }

  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        memoryCache[AUTH_TOKEN_KEY] = token;
        return token;
      }
    } catch {}
  }

  return null;
}

/**
 * Persists the authentication token across both localStorage and Capacitor Native Preferences.
 */
export async function setStoredAuthToken(token: string): Promise<void> {
  if (!token) return;

  memoryCache[AUTH_TOKEN_KEY] = token;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {}
  }

  try {
    await Preferences.set({ key: AUTH_TOKEN_KEY, value: token });
  } catch {}
}

/**
 * Clears the stored auth token upon logout.
 */
export async function clearStoredAuthToken(): Promise<void> {
  delete memoryCache[AUTH_TOKEN_KEY];

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {}
  }

  try {
    await Preferences.remove({ key: AUTH_TOKEN_KEY });
  } catch {}
}
