"use client";

import React, { useState, useEffect } from "react";
import { MarketIndexDistrictTrend } from "@/lib/types/smartFeatures";
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  Loader2,
} from "lucide-react";

export default function MarketIndexPage() {
  const [trends, setTrends] = useState<MarketIndexDistrictTrend[]>([]);
  const [financialParams, setFinancialParams] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-features/market-index");
      const data = await res.json();
      if (data.data) {
        setTrends(data.data.trends || []);
        setFinancialParams(data.data.financialParams || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            مؤشرات استرشادية أولية
          </span>
          <span className="text-xs text-slate-400">مرجع الصحافة العقارية والمستثمرين</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">مؤشرات استرشادية لأسعار العقارات</h1>
        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
          عرض أولي لمؤشرات الأسعار والطلب. هذه البيانات استرشادية ولا تمثل معاملات موثقة أو تقييمًا رسميًا للعقار.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500">جاري احتساب مؤشرات السوق العقاري...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Quick Macro Indicators Strip */}
          {financialParams && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 block mb-1">سعر جرام الذهب عيار 24</span>
                <strong className="text-lg font-black text-amber-600 font-mono">
                  {financialParams.goldGram24PriceEgp.toLocaleString("ar-EG")} ج.م
                </strong>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 block mb-1">معدل التضخم السنوي</span>
                <strong className="text-lg font-black text-rose-600 font-mono">
                  {financialParams.annualInflationRatePercent}%
                </strong>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 block mb-1">متوسط نمو العقارات السنوي</span>
                <strong className="text-lg font-black text-brand-600 font-mono">
                  +{financialParams.averageAnnualAppreciationRatePercent}%
                </strong>
              </div>
            </div>
          )}

          {/* District Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">مقارنة استرشادية بين المناطق</h3>
                <p className="text-xs text-slate-500">المعلومات المعروضة أولية، ويجب التحقق من السعر والطلب ميدانيًا قبل اتخاذ قرار.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                    <th className="p-4">المنطقة والحي</th>
                    <th className="p-4">متوسط سعر المتر</th>
                    <th className="p-4">النمو السنوي (YoY)</th>
                    <th className="p-4">مؤشر زخم الطلب</th>
                    <th className="p-4">العائد الإيجاري الصافي</th>
                    <th className="p-4">الوحدات الأكثر طلباً</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {trends.map((t) => (
                    <tr key={t.districtId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-black text-slate-900 text-sm">
                        {t.districtNameAr}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900 text-sm">
                        {t.avgPricePerSqM.toLocaleString("ar-EG")} ج.م / م²
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-600">
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                          +{t.yoyGrowthPercent}%
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${t.demandScore}%` }}></div>
                          </div>
                          <span className="font-bold text-slate-700 font-mono">{t.demandScore}/100</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-black text-emerald-700">
                        {t.rentalYieldPercent}% سنوياً
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        {t.mostDemandedType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
