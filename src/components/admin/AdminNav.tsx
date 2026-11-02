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
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
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
              className="rounded-lg bg-white object-contain"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-white">
                  {visualIdentity.siteName || "دار العقار"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  شركة الإدارة
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">
                لوحة التحكم المركزية • الإدارة العليا
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors border border-slate-700"
            >
              <span>معاينة المنصة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors border border-rose-500/20"
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
