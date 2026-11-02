"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { DEFAULT_BRAND_LOGO_PATH, DEFAULT_VISUAL_IDENTITY, getBrandLogoHeightPx } from "@/lib/brand-theme";
import type { CmsHomepageSettings } from "@/lib/db/types";
import {
  LogOut,
  ExternalLink,
} from "lucide-react";

export default function AdminNav() {
  const router = useRouter();
  const [visualIdentity, setVisualIdentity] = useState(DEFAULT_VISUAL_IDENTITY);

  const loadVisualIdentity = useCallback(async () => {
    const response = await fetch("/api/cms/homepage", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`CMS homepage settings request failed (${response.status})`);
    }
    const data = await response.json();
    const settings = data.settings as CmsHomepageSettings | undefined;
    if (settings?.visualIdentity) {
      setVisualIdentity({ ...DEFAULT_VISUAL_IDENTITY, ...settings.visualIdentity });
    }
  }, []);

  useEffect(() => {
    void loadVisualIdentity().catch((error: unknown) => {
      console.error("[AdminNav] Could not load branding settings:", error);
    });
    const handleSettingsUpdated = () => {
      void loadVisualIdentity().catch((error: unknown) => {
        console.error("[AdminNav] Could not refresh branding settings:", error);
      });
    };
    window.addEventListener("cms-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("cms-settings-updated", handleSettingsUpdated);
  }, [loadVisualIdentity]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.dispatchEvent(new Event("auth-state-changed"));
      window.location.href = "/admin/login";
    } catch {
      window.location.href = "/admin/login";
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 text-slate-900 shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 xl:px-10">
        <div
          className="flex items-center justify-between py-2"
          style={{ minHeight: `${Math.max(64, getBrandLogoHeightPx(visualIdentity) + 16)}px` }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            <NextImage
              src={visualIdentity.logoImageUrl || DEFAULT_BRAND_LOGO_PATH}
              alt={visualIdentity.siteName || "دار العقار"}
              width={96}
              height={50}
              unoptimized
              style={{ height: `${getBrandLogoHeightPx(visualIdentity)}px`, width: "auto" }}
              className="rounded-xl border border-slate-100 bg-white object-contain p-1"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-slate-950">
                  {visualIdentity.siteName || "دار العقار"}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  مساحة الفريق
                </span>
              </div>
              <span className="block text-[10px] font-medium text-slate-500">
                إدارة المنصة ومتابعة أعمالها
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <span>معاينة المنصة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
