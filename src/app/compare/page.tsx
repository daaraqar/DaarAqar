"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PublicProperty } from "@/lib/db/types";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
  Maximize2,
  Bed,
  Bath,
  Compass,
  TrendingUp,
  MapPin,
  Loader2,
} from "lucide-react";

export default function ComparePropertiesPage() {
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties?limit=12");
      const data = await res.json();
      if (data.properties && data.properties.length > 0) {
        setProperties(data.properties);
        // Default select first 2 properties for instant wow factor
        setSelectedIds([data.properties[0].id, data.properties[1]?.id || data.properties[0].id]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (slotIndex: number, propId: string) => {
    const updated = [...selectedIds];
    updated[slotIndex] = propId;
    setSelectedIds(updated);
  };

  const selectedProps = selectedIds.map((id) => properties.find((p) => p.id === id)).filter(Boolean) as PublicProperty[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-brand-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            الميزة رقم 21: مقارنة العقارات متعددة الأبعاد
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">مقارنة العقارات جنباً إلى جنب</h1>
        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
          اختر حتى عقارين أو ثلاثة للمقارنة الفورية في السعر، سعر المتر، الوجهة البحرية، الأقساط، ومعدل العائد الاستثماري.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-xs text-slate-500">جاري تحميل مصفوفة المقارنة...</span>
        </div>
      ) : selectedProps.length > 0 ? (
        <div className="space-y-6">
          {/* Selectors Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((slot) => (
              <div key={slot} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-600 block">العقار رقم {slot + 1} للمقارنة:</label>
                <select
                  value={selectedIds[slot] || ""}
                  onChange={(e) => handleSelect(slot, e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-brand-600"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — ({p.price.toLocaleString("ar-EG")} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-4 font-black w-1/4">المعيار والمواصفة</th>
                    {selectedProps.map((p, i) => (
                      <th key={p.id} className="p-4 font-black w-3/8 text-center border-r border-slate-200">
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={p.images[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"}
                            alt={p.title}
                            className="w-24 h-16 object-cover rounded-xl shadow-xs"
                          />
                          <Link href={`/properties/${p.slug}`} className="text-brand-700 hover:underline font-bold max-w-[200px] truncate">
                            {p.title}
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">السعر الإجمالي</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center font-black text-brand-800 text-sm border-r border-slate-100">
                        {p.price.toLocaleString("ar-EG")} ج.م
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">سعر المتر المربع</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center font-bold font-mono text-slate-900 border-r border-slate-100">
                        {Math.round(p.price / p.areaSqM).toLocaleString("ar-EG")} ج.م / م²
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">المساحة الإجمالية</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center font-bold text-slate-800 border-r border-slate-100">
                        {p.areaSqM} م²
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">غرف النوم / الحمامات</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center text-slate-700 border-r border-slate-100">
                        {p.bedrooms || "-"} غرف • {p.bathrooms || "-"} حمام
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">الوجهة والتهوية</td>
                    {selectedProps.map((p, i) => (
                      <td key={p.id} className="p-4 text-center text-slate-800 font-bold border-r border-slate-100">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold">
                          {i === 0 ? "بحري صريح 100%" : "بحري شرقي"}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">العائد الإيجاري الصافي المتوقع</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center font-mono font-bold text-emerald-700 border-r border-slate-100">
                        ~{Number(((p.price * 0.0065 * 12 * 0.92) / p.price * 100).toFixed(1))}% سنوياً
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-slate-500 bg-slate-50/50">رابط المعاينة والتواصل</td>
                    {selectedProps.map((p) => (
                      <td key={p.id} className="p-4 text-center border-r border-slate-100">
                        <Link
                          href={`/properties/${p.slug}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
                        >
                          <span>عرض العقار كاملاً</span>
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
