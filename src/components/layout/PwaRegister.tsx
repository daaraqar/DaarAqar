"use client";

import { useEffect } from "react";
import { isCapacitorPlatform } from "@/lib/apiClient";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Inside Capacitor Mobile Native WebView:
    // Strictly DISABLE Service Worker and Purge any existing Stale Caches
    if (isCapacitorPlatform()) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("[Mobile] Stale Service Worker unregistered successfully.");
              }
            });
          }
        });
      }

      // Purge all stale CacheStorage entries to ensure live dynamic assets
      if ("caches" in window) {
        caches.keys().then((keys) => {
          return Promise.all(
            keys.map((key) => {
              console.log("[Mobile] Purging stale CacheStorage key:", key);
              return caches.delete(key);
            })
          );
        });
      }
      return;
    }

    // Standard Web PWA registration (only for regular browsers outside Capacitor)
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.error("[PWA] Service Worker registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
