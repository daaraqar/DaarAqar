"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { InvestorPortfolioItem } from "@/lib/types/smartFeatures";
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Wallet,
} from "lucide-react";

export default function InvestorPortfolioPage() {
  const [items, setItems] = useState<InvestorPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal inputs
  const [propertyTitle, setPropertyTitle] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(5000000);
  const [currentEstimate, setCurrentEstimate] = useState(7200000);
  const [monthlyRent, setMonthlyRent] = useState(35000);
  const [occupancyStatus, setOccupancyStatus] = useState<"rented" | "vacant" | "under_finishing" | "for_resale">("rented");

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-features/portfolio");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyTitle || !purchasePrice) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/smart-features/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyTitle,
          purchasePrice,
          currentMarketEstimate: currentEstimate,
          rentalIncomeMonthly: monthlyRent,
          occupancyStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchPortfolio();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations
  const totalPurchaseValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
  const totalCurrentValue = items.reduce((sum, item) => sum + item.currentMarketEstimate, 0);
  const totalMonthlyRent = items.reduce((sum, item) => sum + item.rentalIncomeMonthly, 0);
  const totalCapitalGain = totalCurrentValue - totalPurchaseValue;
  const totalReturnPercent = totalPurchaseValue > 0 ? ((totalCapitalGain / totalPurchaseValue) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              الميزة رقم 29: محفظة إدارة أملاك المستثمر
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">محفظتي العقارية وتتبع الأصول</h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
            لوحة موحدة لمتابعة نمو رأس المال العقاري، وتواريخ تحصيل الإيجارات، واستحقاق شيكات الأقساط للمطورين.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عقار إلى المحفظة</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500">جاري قراءة بيانات المحفظة...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Portfolio Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-400">القيمة السوقية الإجمالية للأصول</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {totalCurrentValue.toLocaleString("ar-EG")} <span className="text-xs font-sans">ج.م</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold block">
                تحديث أسعار السوق لعام 2026
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-400">صافي الأرباح الرأسمالية المحققة</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                +{totalCapitalGain.toLocaleString("ar-EG")} <span className="text-xs font-sans">ج.م</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold block">
                نمو إجمالي بنسبة +{totalReturnPercent}%
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-400">دخل الإيجار الشهري المحصل</span>
              <div className="text-2xl font-black text-brand-600 font-mono">
                {totalMonthlyRent.toLocaleString("ar-EG")} <span className="text-xs font-sans">ج.م / شهر</span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold block">
                {(totalMonthlyRent * 12).toLocaleString("ar-EG")} ج.م سنوياً
              </span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-400">عدد الأصول المدارة</span>
              <div className="text-2xl font-black text-indigo-600 font-mono">
                {items.length} <span className="text-xs font-sans">وحدات عقارية</span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold block">
                سجل الأقساط منتظم بنسبة 100%
              </span>
            </div>
          </div>

          {/* Properties List in Portfolio */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">سجل الوحدات والأقساط المستحقة</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          item.occupancyStatus === "rented"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.occupancyStatus === "under_finishing"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.occupancyStatus === "rented"
                          ? "مؤجرة حالياً"
                          : item.occupancyStatus === "under_finishing"
                          ? "قيد التشطيب"
                          : "شاغرة"}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        تاريخ الشراء: {item.purchaseDate}
                      </span>
                    </div>
                    <h4 className="font-black text-base text-slate-900">{item.propertyTitle}</h4>
                    {item.tenantName && (
                      <span className="text-xs text-slate-500 block">
                        المستأجر: <strong className="text-slate-700">{item.tenantName}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">سعر الشراء</span>
                      <strong className="text-slate-800 font-mono font-bold">
                        {item.purchasePrice.toLocaleString("ar-EG")} ج.م
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">القيمة السوقية الحالية</span>
                      <strong className="text-emerald-700 font-mono font-black">
                        {item.currentMarketEstimate.toLocaleString("ar-EG")} ج.م
                      </strong>
                    </div>

                    {item.rentalIncomeMonthly > 0 && (
                      <div>
                        <span className="text-slate-400 block mb-0.5">الإيجار الشهري</span>
                        <strong className="text-brand-700 font-mono font-bold">
                          {item.rentalIncomeMonthly.toLocaleString("ar-EG")} ج.م
                        </strong>
                      </div>
                    )}

                    {item.nextInstallmentAmount && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-amber-800 font-bold block mb-0.5">قسط قادم في {item.nextInstallmentDueDate}</span>
                        <strong className="text-amber-950 font-mono font-black">
                          {item.nextInstallmentAmount.toLocaleString("ar-EG")} ج.م
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal to Add Asset */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">إضافة عقار جديد للمحفظة</h3>
            <p className="text-xs text-slate-500">سجل استثمارك لمتابعة العائد والقيمة السوقية.</p>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم العقار / الكمبوند</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شقة 180م في ميت غمر أو إحدى قراها"
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">سعر الشراء الأساسي (ج.م)</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">القيمة التقديرية الحالية (ج.م)</label>
                  <input
                    type="number"
                    value={currentEstimate}
                    onChange={(e) => setCurrentEstimate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الإيجار الشهري الحالي (إن وجد)</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">حالة الإشغال</label>
                  <select
                    value={occupancyStatus}
                    onChange={(e) => setOccupancyStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  >
                    <option value="rented">مؤجرة حالياً</option>
                    <option value="vacant">شاغرة</option>
                    <option value="under_finishing">قيد التشطيب</option>
                    <option value="for_resale">معروضة للبيع</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors cursor-pointer flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>حفظ العقار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
