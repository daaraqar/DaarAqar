"use client";

import React from "react";
import Link from "next/link";
import { Map, MapPin } from "lucide-react";

export default function HomeMapPreview() {
  return (
    <Link
      href="/explore"
      className="group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-105 hover:border-teal-400/50"
    >
      {/* Glowing Ambient Aura */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-teal-400/30 to-brand-400/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Icon Emblem Container */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-brand-800 to-teal-700 border border-white/30 shadow-inner flex items-center justify-center group-hover:rotate-2 transition-transform">
        {/* Concentric Pulse Rings */}
        <span className="absolute -inset-2 rounded-3xl border border-teal-400/40 animate-ping opacity-30 pointer-events-none" />

        {/* Primary Service Icon: Map + MapPin */}
        <div className="relative">
          <Map className="w-14 h-14 sm:w-16 sm:h-16 text-white stroke-[1.75] drop-shadow-lg" />
          <div className="absolute -top-2 -right-2 p-1.5 rounded-xl bg-emerald-500 text-white shadow-lg border-2 border-brand-900">
            <MapPin className="w-4 h-4 fill-white" />
          </div>
        </div>
      </div>

      {/* Service Badge & Labels */}
      <div className="relative mt-4 text-center space-y-1">
        <span className="text-sm sm:text-base font-black text-white block tracking-wide">
          الخريطة العقارية الذكية
        </span>
        <span className="text-[11px] text-teal-200 font-medium block">
          استكشاف جغرافي مباشر وتفاعلي
        </span>
        <div className="pt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>تصفح الخريطة الحية &larr;</span>
        </div>
      </div>
    </Link>
  );
}
