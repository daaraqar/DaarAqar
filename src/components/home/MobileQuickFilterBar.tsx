"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  Building2,
  Home,
  Layers,
  Sparkles,
  MapPin,
  CircleDollarSign,
  Flame,
} from "lucide-react";

export default function MobileQuickFilterBar() {
  const quickFilters = [
    {
      label: "الخريطة الذكية",
      href: "/explore",
      icon: Compass,
      color: "bg-brand-600 text-white",
      isPrimary: true,
    },
    {
      label: "شقق للبيع",
      href: "/properties?transactionType=sale&category=apartment",
      icon: Building2,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "شقق إيجار",
      href: "/properties?transactionType=rent&category=apartment",
      icon: Layers,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "بيوت ومنازل",
      href: "/properties?category=house",
      icon: Home,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "أراضي للبيع",
      href: "/properties?category=land",
      icon: MapPin,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "دقادوس",
      href: "/explore?q=دقادوس",
      icon: MapPin,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "تفهنا الأشراف",
      href: "/explore?q=تفهنا الأشراف",
      icon: Sparkles,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "دماص",
      href: "/explore?q=دماص",
      icon: MapPin,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "صهرجت الكبرى",
      href: "/explore?q=صهرجت الكبرى",
      icon: MapPin,
      color: "bg-white text-slate-800 border-slate-200",
    },
    {
      label: "فيديو ريلز",
      href: "/reels",
      icon: Flame,
      color: "bg-rose-50 text-rose-700 border-rose-200",
    },
  ];

  return (
    <div className="lg:hidden w-full overflow-x-auto no-scrollbar py-2 px-4 -mx-4 flex items-center gap-2 scroll-smooth">
      {quickFilters.map((item, idx) => {
        const Icon = item.icon;
        return (
          <Link
            key={idx}
            href={item.href}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs active:scale-95 transition-all ${
              item.isPrimary
                ? "bg-brand-600 text-white shadow-brand-600/30 font-black"
                : "bg-white/90 text-slate-700 border border-slate-200/90 hover:bg-slate-50"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${item.isPrimary ? "text-brand-200" : "text-brand-600"}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
