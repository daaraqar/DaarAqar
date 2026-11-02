"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CompoundMasterplan } from "@/lib/types/smartFeatures";
import {
  Building2,
  Calendar,
  MapPin,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Search,
  ChevronLeft,
  Sparkles,
  Layers,
  Home,
  Tag,
  Plus,
  Clock,
} from "lucide-react";

interface CompoundWithReal extends CompoundMasterplan {
  isRealProperty?: boolean;
  category?: string;
}

export default function ProjectsShowcasePage() {
  const [compounds, setCompounds] = useState<CompoundWithReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/smart-features/compounds")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.compounds) {
          setCompounds(data.compounds);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const filteredCompounds = compounds.filter((comp) => {
    const matchesCategory =
      activeCategory === "all" ||
      comp.category === activeCategory ||
      (activeCategory === "villas" && (comp.category === "villa" || comp.nameAr.includes("فيلا") || comp.nameAr.includes("تاون"))) ||
      (activeCategory === "apartments" && (comp.category === "apartment" || comp.nameAr.includes("شقة"))) ||
      (activeCategory === "commercial" && (comp.category === "commercial_retail" || comp.category === "office"));

    const matchesSearch =
      !searchQuery ||
      comp.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.districtNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.developerNameAr.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-28 font-sans" dir="rtl">
      {/* 1. Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <Link href="/" className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-base font-black text-slate-900 tracking-tight">المشاريع العقارية</h1>
        <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs">
          الإضافة متاحة قريبًا
        </span>
      </div>

      {/* Temporary Closed Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900 font-bold">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>قسم المشاريع مغلق مؤقتاً للتطوير والتحديث وسيتوفر قريباً بكافة المزايا.</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200/80 text-amber-900 font-black shrink-0">
          مغلق مؤقتاً
        </span>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 space-y-3 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم، المطور، أو المنطقة..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { key: "all", label: "كافة المشاريع" },
            { key: "apartments", label: "شقق ومجمعات" },
            { key: "villas", label: "فلل وقصور" },
            { key: "commercial", label: "تجاري وإداري" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === tab.key
                  ? "bg-emerald-700 text-white shadow-xs font-black"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
          <span className="text-xs text-slate-500 font-bold">جاري تحميل المشاريع العقارية الحية...</span>
        </div>
      ) : compounds.length === 0 ? (
        <div className="pt-8 px-4 max-w-lg mx-auto text-center">
          <div className="bg-white p-10 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900">لا توجد مشاريع معروضة حالياً</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                تمت تهيئة المنصة للتشغيل الفعلي ومسح المشاريع الافتراضية. ستظهر المشاريع والمجمعات السكنية والتجارية المعتمدة هنا فور إضافتها واعتمادها.
              </p>
            </div>
            <Link
              href="/dashboard/properties/new"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عقار جديد</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pt-4 px-4 max-w-lg mx-auto">
          {/* 2. مشاريع مميزة ومضافة حديثاً (Featured Projects) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>مشاريع متميزة ونشطة</span>
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {filteredCompounds.length} مشروع
              </span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {filteredCompounds.slice(0, 6).map((comp) => {
                const linkHref = `/projects/${comp.id}`;
                return (
                  <Link
                    key={comp.id}
                    href={linkHref}
                    className="w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all overflow-hidden flex flex-col group"
                  >
                    <div className="relative h-40 bg-slate-200 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={comp.coverImage}
                        alt={comp.nameAr}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white shadow-xs">
                        {comp.isRealProperty ? "مضاف حديثاً ✓" : "متاح للحجز"}
                      </div>
                      <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900/80 text-white backdrop-blur-xs">
                        استلام {comp.deliveryYear}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-1.5 text-right">
                      <div className="text-[11px] font-bold text-slate-400 truncate">{comp.developerNameAr}</div>
                      <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                        {comp.nameAr}
                      </h3>
                      <div className="text-sm font-black text-emerald-700">
                        يبدأ من {comp.startingPrice.toLocaleString("ar-EG")} ج.م
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{comp.districtNameAr}</span>
                        </span>
                        <span className="text-emerald-700 font-bold shrink-0">
                          تقسيط حتى {comp.installmentYearsMax} سنوات
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 3. استكشف المناطق */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-900">استكشف المناطق الرئيسية</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: "دقادوس", count: "مشاريع حية", img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&q=80" },
                { name: "وسط ميت غمر", count: "مشاريع حية", img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80" },
                { name: "تفهنا الأشراف", count: "مشاريع حية", img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&q=80" },
              ].map((reg) => (
                <div
                  key={reg.name}
                  onClick={() => setSearchQuery(reg.name)}
                  className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xs group cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reg.img} alt={reg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-2 text-white text-right">
                    <span className="text-xs font-black leading-tight">{reg.name}</span>
                    <span className="text-[10px] text-emerald-300 font-bold">{reg.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. قائمة كل المشاريع المضافة والمتاحة */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">كل المشاريع المتاحة</h2>
              <span className="text-xs font-bold text-slate-400">{filteredCompounds.length} مشروع</span>
            </div>

            {filteredCompounds.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-xs font-bold text-slate-700">لم يتم العثور على مشاريع مطابقة</h3>
                <p className="text-[11px] text-slate-400">جرب تغيير معايير البحث أو تصفح كافة الفئات</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCompounds.map((comp) => {
                  const linkHref = `/projects/${comp.id}`;
                  return (
                    <Link
                      key={comp.id}
                      href={linkHref}
                      className="block bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all overflow-hidden group"
                    >
                      <div className="relative h-44 bg-slate-200 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={comp.coverImage}
                          alt={comp.nameAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white shadow-xs">
                          {comp.isRealProperty ? "مشروع مضاف حديثاً" : "متاح للحجز"}
                        </div>
                        {comp.isRealProperty && (
                          <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900/80 text-white backdrop-blur-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>معتمد</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 space-y-2 text-right">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {comp.nameAr}
                          </h3>
                          <span className="text-sm font-black text-emerald-700 shrink-0">
                            {comp.startingPrice.toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {comp.descriptionAr}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-bold">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{comp.districtNameAr}</span>
                          </span>
                          <span className="text-emerald-700 font-bold shrink-0">
                            تقسيط حتى {comp.installmentYearsMax} سنوات
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
