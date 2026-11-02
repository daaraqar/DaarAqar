"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Search,
  Compass,
  Building2,
  Home,
  Layers,
  Sparkles,
  MapPin,
  ChevronLeft,
  RotateCcw,
  Check,
} from "lucide-react";
import { OFFICIAL_PROPERTY_CATEGORIES } from "@/lib/db/types";

interface MobileSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_AREAS = [
  { name: "مدينة ميت غمر", districtId: "dist-meet-ghamr-city", icon: "🏙️" },
  { name: "دقادوس", districtId: "dist-daqados", icon: "🌳" },
  { name: "تفهنا الأشراف", districtId: "dist-tafahna-al-ashraf", icon: "🏛️" },
  { name: "صهرجت الكبرى", districtId: "dist-sehregt-kobra", icon: "🌿" },
  { name: "دماص", districtId: "dist-damas", icon: "🏢" },
  { name: "أتميدة", districtId: "dist-atmida", icon: "✨" },
  { name: "كوم النور", districtId: "dist-kom-el-nour", icon: "📍" },
];

const PROPERTY_TYPES = OFFICIAL_PROPERTY_CATEGORIES.map(({ value, label }) => ({
  id: value,
  label,
  icon: value === "villa" || value === "house" ? Home : Building2,
}));

export default function MobileSearchDrawer({ isOpen, onClose }: MobileSearchDrawerProps) {
  const router = useRouter();
  const [transactionType, setTransactionType] = useState<"sale" | "rent">("sale");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setTransactionType("sale");
    setSelectedArea(null);
    setSelectedCategory(null);
    setSelectedPriceRange(null);
    setSearchQuery("");
  };

  const handleExecuteSearch = (target: "explore" | "properties") => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append("q", searchQuery.trim());
    if (selectedArea) params.append("districtId", selectedArea);
    if (transactionType) params.append("transactionType", transactionType);
    if (selectedCategory) params.append("category", selectedCategory);

    if (selectedPriceRange) {
      if (transactionType === "rent") {
        if (selectedPriceRange === "under15k") params.append("maxPrice", "15000");
        if (selectedPriceRange === "15k-30k") {
          params.append("minPrice", "15000");
          params.append("maxPrice", "30000");
        }
        if (selectedPriceRange === "30k-60k") {
          params.append("minPrice", "30000");
          params.append("maxPrice", "60000");
        }
        if (selectedPriceRange === "above60k") params.append("minPrice", "60000");
      } else {
        if (selectedPriceRange === "under3m") params.append("maxPrice", "3000000");
        if (selectedPriceRange === "3m-7m") {
          params.append("minPrice", "3000000");
          params.append("maxPrice", "7000000");
        }
        if (selectedPriceRange === "7m-15m") {
          params.append("minPrice", "7000000");
          params.append("maxPrice", "15000000");
        }
        if (selectedPriceRange === "above15m") params.append("minPrice", "15000000");
      }
    }

    onClose();
    if (target === "explore") {
      router.push(`/explore?${params.toString()}`);
    } else {
      router.push(`/properties?${params.toString()}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Sheet */}
      <div className="bg-white rounded-t-3xl border-t border-slate-200 max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Drawer Header Handle & Title */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">البحث السريع المباشر</h2>
              <p className="text-[10px] text-slate-500">حدد مستهدفك بدقة وسرعة فائقة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2 py-1 rounded-lg"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إعادة ضبط</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-4 overflow-y-auto space-y-5 text-right">
          {/* 1. Transaction Type Toggle */}
          <div>
            <label className="text-[11px] font-black text-slate-700 block mb-2">نوع العملية</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setTransactionType("sale");
                  setSelectedPriceRange(null);
                }}
                className={`py-2 rounded-xl text-xs font-black transition-all ${
                  transactionType === "sale"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                شراء / للبيع
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransactionType("rent");
                  setSelectedPriceRange(null);
                }}
                className={`py-2 rounded-xl text-xs font-black transition-all ${
                  transactionType === "rent"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                إيجار شهري / سنوي
              </button>
            </div>
          </div>

          {/* 2. Direct Search Text Input */}
          <div>
            <label className="text-[11px] font-black text-slate-700 block mb-2">
              اسم الحي، الكمبوند، أو كود العقار
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="مثال: ميت غمر، دقادوس، أتميدة..."
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* 3. Top Egyptian Hubs (1-Tap Selection) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-slate-700">مناطق مركز ميت غمر وقراه</label>
              {selectedArea && (
                <button
                  type="button"
                  onClick={() => setSelectedArea(null)}
                  className="text-[10px] text-rose-600 font-bold"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_AREAS.map((area) => (
                <button
                  key={area.districtId}
                  type="button"
                  onClick={() =>
                    setSelectedArea(selectedArea === area.districtId ? null : area.districtId)
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedArea === area.districtId
                      ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/30"
                      : "bg-slate-50 text-slate-700 border border-slate-200/80 hover:bg-slate-100"
                  }`}
                >
                  <span>{area.icon}</span>
                  <span>{area.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Property Category (Grid Cards) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-slate-700">نوع العقار</label>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-[10px] text-rose-600 font-bold"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PROPERTY_TYPES.map((type) => {
                const Icon = type.icon;
                const active = selectedCategory === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(selectedCategory === type.id ? null : type.id)
                    }
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all ${
                      active
                        ? "border-brand-600 bg-brand-50/70 text-brand-800 font-black shadow-xs ring-1 ring-brand-500"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1 ${active ? "text-brand-600" : "text-slate-400"}`} />
                    <span className="text-[11px]">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Budget / Price Range Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-slate-700">الميزانية والحد السعري</label>
              {selectedPriceRange && (
                <button
                  type="button"
                  onClick={() => setSelectedPriceRange(null)}
                  className="text-[10px] text-rose-600 font-bold"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {transactionType === "sale" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "under3m" ? null : "under3m")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "under3m"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    أقل من 3 مليون ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "3m-7m" ? null : "3m-7m")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "3m-7m"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    3 - 7 مليون ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "7m-15m" ? null : "7m-15m")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "7m-15m"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    7 - 15 مليون ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "above15m" ? null : "above15m")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "above15m"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    أكثر من 15 مليون ج.م
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "under15k" ? null : "under15k")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "under15k"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    أقل من 15,000 ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "15k-30k" ? null : "15k-30k")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "15k-30k"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    15,000 - 30,000 ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "30k-60k" ? null : "30k-60k")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "30k-60k"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    30,000 - 60,000 ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPriceRange(selectedPriceRange === "above60k" ? null : "above60k")
                    }
                    className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPriceRange === "above60k"
                        ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    أكثر من 60,000 ج.م
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/90 flex items-center gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => handleExecuteSearch("explore")}
            className="flex-1 py-3 px-3 rounded-2xl bg-slate-900 text-white font-extrabold text-xs shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Compass className="w-4 h-4 text-brand-400" />
            <span>عرض بالخريطة الذكية</span>
          </button>

          <button
            type="button"
            onClick={() => handleExecuteSearch("properties")}
            className="flex-1 py-3 px-3 rounded-2xl bg-brand-600 text-white font-extrabold text-xs shadow-md hover:bg-brand-700 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Check className="w-4 h-4 text-white" />
            <span>عرض قائمة العقارات</span>
          </button>
        </div>
      </div>
    </div>
  );
}
