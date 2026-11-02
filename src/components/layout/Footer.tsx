"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CmsHomepageSettings } from "@/lib/db/types";

export default function Footer() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<CmsHomepageSettings | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const loadSettings = () => {
      fetch("/api/cms/homepage", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("تعذر تحميل إعدادات التذييل");
          const data = await response.json();
          if (data.settings) setSettings(data.settings as CmsHomepageSettings);
        })
        .catch((error: unknown) => console.error("[Footer] CMS settings load failed:", error));
    };
    loadSettings();
    window.addEventListener("cms-settings-updated", loadSettings);
    return () => window.removeEventListener("cms-settings-updated", loadSettings);
  }, [pathname]);

  if (pathname === "/" || pathname.startsWith("/admin")) return null;
  const labels = settings?.navLabels;
  const siteName = settings?.visualIdentity?.siteName || "دار العقار";
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 py-6 pb-28 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center">
            <span>© {new Date().getFullYear()} {siteName}. جميع الحقوق محفوظة.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              {labels?.privacy || "سياسة الخصوصية"}
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              {labels?.terms || "شروط الاستخدام"}
            </Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-slate-300 transition-colors">
              {labels?.contact || "اتصل بنا"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
