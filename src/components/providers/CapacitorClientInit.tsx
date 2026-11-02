"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { isCapacitorPlatform, resolveApiUrl } from "@/lib/apiClient";
import {
  getStoredAuthTokenSync,
  setStoredAuthToken,
  clearStoredAuthToken,
} from "@/lib/auth/mobileAuthStorage";

/**
 * Automatically patches window.fetch inside Capacitor WebView so that any
 * relative fetch('/api/...') call seamlessly targets the full server URL
 * and automatically injects Authorization Bearer tokens for mobile persistence.
 * Also registers the Android Hardware Back Button listener to close modals or router.back().
 */
export default function CapacitorClientInit() {
  const router = useRouter();
  const pathname = usePathname();

  // 1. Android Hardware Back Button Handler
  useEffect(() => {
    if (!isCapacitorPlatform()) return;

    let backListenerHandle: any = null;

    const setupBackButton = async () => {
      try {
        backListenerHandle = await App.addListener("backButton", ({ canGoBack }) => {
          // Check if any open Modal, Drawer, or Dialog exists in the DOM
          const openDialogs = document.querySelectorAll(
            '[role="dialog"], [aria-modal="true"], .modal-open, [data-state="open"]'
          );

          if (openDialogs.length > 0) {
            const topDialog = openDialogs[openDialogs.length - 1];

            // 1. Try finding and clicking close button
            const closeBtn = topDialog.querySelector<HTMLElement>(
              'button[aria-label*="إغلاق"], button[aria-label*="close" i], button.close-modal, [data-close-modal]'
            );

            if (closeBtn) {
              closeBtn.click();
              return;
            }

            // 2. Dispatch Escape key event to trigger custom modal dismissal
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true,
              })
            );
            return;
          }

          // If no modal is open, navigate back if not at the root route
          if (pathname !== "/" && (canGoBack || window.history.length > 1)) {
            router.back();
            return;
          }

          // At root / and cannot go back: exit or minimize app
          App.exitApp();
        });
      } catch (err) {
        console.warn("[CapacitorClientInit] Failed to register backButton listener:", err);
      }
    };

    setupBackButton();

    return () => {
      if (backListenerHandle && typeof backListenerHandle.remove === "function") {
        backListenerHandle.remove();
      }
    };
  }, [pathname, router]);

  // 2. Window.fetch Patching for Mobile Auth Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let finalInput = input;
      const isApiPath =
        (typeof input === "string" && input.startsWith("/api/")) ||
        (input instanceof URL && input.pathname.startsWith("/api/"));

      // Resolve relative API path to absolute URL if running inside Capacitor
      if (isCapacitorPlatform() && isApiPath) {
        if (typeof input === "string") {
          finalInput = resolveApiUrl(input);
        } else if (input instanceof URL) {
          finalInput = resolveApiUrl(input.pathname + input.search);
        }
      }

      // Auto-inject Authorization Bearer header if user has active session
      const headers = new Headers(init?.headers || {});
      if (isApiPath && !headers.has("Authorization")) {
        const token = getStoredAuthTokenSync();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      const mergedInit: RequestInit = {
        ...init,
        credentials: init?.credentials || "include",
        headers,
      };

      const res = await originalFetch(finalInput, mergedInit);

      // Persist the token before returning the response so a login page cannot redirect
      // and reload the WebView before mobile storage finishes.
      if (isApiPath && res.ok) {
        const urlStr = typeof finalInput === "string" ? finalInput : finalInput.toString();
        if (
          urlStr.includes("/api/auth/login") ||
          urlStr.includes("/api/auth/email-otp/verify") ||
          urlStr.includes("/api/auth/register")
        ) {
          const data = await res.clone().json();
          if (typeof data?.token === "string" && data.token) {
            await setStoredAuthToken(data.token);
          } else {
            console.error("[CapacitorClientInit] Auth response did not include a session token.");
          }
        } else if (urlStr.includes("/api/auth/logout")) {
          await clearStoredAuthToken();
        }
      }

      return res;
    };
  }, []);

  return null;
}
