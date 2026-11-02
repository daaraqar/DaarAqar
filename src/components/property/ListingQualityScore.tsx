"use client";

import React from "react";
import { Sparkles, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";

export interface QualityScorableProperty {
  id?: string;
  title?: string;
  price?: number;
  areaSqM?: number;
  images?: string[];
  description?: string;
  addressDetails?: string;
  category?: string;
  transactionType?: string;
}

export function computeListingQuality(prop: QualityScorableProperty) {
  let score = 0;
  const tips: string[] = [];

  // 1. Images (up to 30%)
  const imgCount = prop.images?.length || 0;
  if (imgCount >= 4) {
    score += 30;
  } else if (imgCount === 3) {
    score += 22;
    tips.push("أضف صورة واحدة إضافية للحصول على ظهور أعلى بنسبة 25% في ميت غمر");
  } else if (imgCount === 2) {
    score += 15;
    tips.push("أضف صورتين إضافيتين للحصول على ظهور أعلى بنسبة 40% في ميت غمر");
  } else if (imgCount === 1) {
    score += 8;
    tips.push("أضف 3 صور إضافية للحصول على ظهور أعلى بنسبة 50% في ميت غمر");
  } else {
    tips.push("أضف 4 صور على الأقل لرفع ثقة المشترين في ميت غمر");
  }

  // 2. Detailed Description (up to 25%)
  const descLen = prop.description?.trim().length || 0;
  if (descLen >= 80) {
    score += 25;
  } else if (descLen >= 30) {
    score += 15;
    tips.push("أكمل وصف العقار بالتشطيب والمميزات لمساعدة الباحثين على تقييمه");
  } else {
    score += 5;
    tips.push("اكتب وصفاً تفصيلياً للعقار لتسريع استفسارات المشترين");
  }

  // 3. Clear Pricing & Area (up to 25%)
  const hasPrice = (prop.price ?? 0) > 0;
  const hasArea = (prop.areaSqM ?? 0) > 0;
  if (hasPrice && hasArea) {
    score += 25;
  } else if (hasPrice || hasArea) {
    score += 15;
    tips.push("أضف المساحة والسعر بدقة ليتوافق الإعلان مع فلاتر البحث");
  } else {
    tips.push("حدد السعر والمساحة لعرض الإعلان في نتائج البحث");
  }

  // 4. Exact Address Details in Mit Ghamr (up to 20%)
  const addrLen = prop.addressDetails?.trim().length || 0;
  if (addrLen >= 10) {
    score += 20;
  } else if (addrLen >= 4) {
    score += 12;
    tips.push("حدد الشارع أو القرية في ميت غمر لزيادة دقة المعاينة");
  } else {
    tips.push("أضف تفاصيل العنوان في ميت غمر");
  }

  // Determine Primary Tip
  const primaryTip =
    tips.length > 0
      ? tips[0]
      : "بيانات الإعلان مكتملة. يمكنك مراجعتها وتحديثها عند الحاجة.";

  return {
    score: Math.min(100, Math.max(10, score)),
    primaryTip,
    tips,
  };
}

interface ListingQualityScoreProps {
  property: QualityScorableProperty;
  compact?: boolean;
}

export default function ListingQualityScore({
  property,
  compact = false,
}: ListingQualityScoreProps) {
  const { score, primaryTip } = computeListingQuality(property);

  const getScoreColor = (s: number) => {
    if (s >= 85) {
      return {
        bar: "from-emerald-500 to-emerald-400",
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
      };
    }
    if (s >= 65) {
      return {
        bar: "from-amber-500 to-amber-400",
        text: "text-amber-800",
        bg: "bg-amber-50/70",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-900",
      };
    }
    return {
      bar: "from-rose-500 to-rose-400",
      text: "text-rose-700",
      bg: "bg-rose-50/70",
      border: "border-rose-200",
      badge: "bg-rose-100 text-rose-800",
    };
  };

  const colors = getScoreColor(score);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Small Vertical Bar */}
        <div className="w-1.5 h-6 bg-slate-200 rounded-full flex flex-col justify-end overflow-hidden" title={`جاهزية الإعلان: ${score}%`}>
          <div
            className={`w-full bg-gradient-to-t ${colors.bar} rounded-full transition-all duration-500`}
            style={{ height: `${score}%` }}
          />
        </div>
        <span className={`text-[11px] font-black font-mono ${colors.text}`}>{score}%</span>
      </div>
    );
  }

  return (
    <div className={`p-2.5 rounded-xl border ${colors.bg} ${colors.border} flex items-center gap-3 transition-all`}>
      {/* Small Vertical Progress Bar Meter (الشريط العمودي الصغير) */}
      <div
        className="relative w-2 h-11 bg-slate-200 rounded-full flex flex-col justify-end overflow-hidden shrink-0 shadow-inner"
        title={`نسبة اكتمال بيانات الإعلان: ${score}%`}
      >
        <div
          className={`w-full bg-gradient-to-t ${colors.bar} rounded-full transition-all duration-700`}
          style={{ height: `${score}%` }}
        />
      </div>

      {/* Details & Dynamic Actionable Tip */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[10px] font-black text-slate-500">
            مؤشر جاهزية الإعلان:
          </span>
          <span className={`px-1.5 py-0.2 rounded-md font-black font-mono text-[11px] ${colors.badge}`}>
            {score}%
          </span>
        </div>
        <p className={`text-[11px] font-medium leading-tight truncate ${colors.text}`}>
          {primaryTip}
        </p>
      </div>
    </div>
  );
}
