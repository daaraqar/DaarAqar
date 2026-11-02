"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { NeighborhoodIntelligence } from "@/lib/types/smartFeatures";
import {
  MapPin,
  TrendingUp,
  Star,
  ShieldCheck,
  Building2,
  Compass,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  Filter,
  Send,
  Loader2,
  School,
  ShoppingBag,
  Trees,
  Car,
} from "lucide-react";
import Link from "next/link";

export default function NeighborhoodsPage() {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodIntelligence | null>(null);

  // Review Form Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [residentName, setResidentName] = useState("");
  const [yearsOfResidency, setYearsOfResidency] = useState(3);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    fetchNeighborhoods();
  }, []);

  const fetchNeighborhoods = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-features/neighborhoods");
      const data = await res.json();
      if (data.success && data.data) {
        setNeighborhoods(data.data);
        if (data.data.length > 0) {
          setSelectedNeighborhood(data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNeighborhood || !residentName || !comment) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/smart-features/neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedNeighborhood.slug,
          residentName,
          yearsOfResidency,
          rating,
          comment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewSuccess(true);
        setTimeout(() => {
          setShowReviewModal(false);
          setReviewSuccess(false);
          setResidentName("");
          setComment("");
          fetchNeighborhoods();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const filtered = neighborhoods;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 p-6 sm:p-10 border border-emerald-500/20 overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
              <span>دليل محلي لمركز ميت غمر وقراه</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              دليل أحياء وقرى مركز ميت غمر
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              استكشف المعلومات والتقييمات المجتمعية للأحياء والقرى في مركز ميت غمر.
            </p>
          </div>
        </div>

        {/* Main Content Layout */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400">جاري تحميل أدلة الأحياء ومؤشرات جودة الحياة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-6 py-16 text-center">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
            <h2 className="text-lg font-black text-white">دليل ميت غمر قيد الإعداد</h2>
            <p className="mt-2 text-sm text-slate-400">
              لم تُضف بيانات تقييم الأحياء والقرى بعد. ستظهر هنا عند توفرها.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Side: Neighborhoods List */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>الأحياء والمدن المتاحة ({filtered.length})</span>
                </h2>
                <span className="text-xs text-slate-400">محدث لشهر أكتوبر 2026</span>
              </div>

              <div className="space-y-3">
                {filtered.map((n) => {
                  const isSelected = selectedNeighborhood?.id === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNeighborhood(n)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-right ${
                        isSelected
                          ? "bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/30"
                          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm sm:text-base text-white">{n.nameAr}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-300">
                              ميت غمر
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">{n.cityNameAr}</span>
                        </div>

                        <div className="text-left shrink-0">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-xs">
                            <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                            <span>{n.overallLivabilityScore}%</span>
                          </div>
                          <span className="block text-[10px] text-slate-400 mt-1">مؤشر الجودة</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">متوسط المتر:</span>
                          <span className="font-bold text-emerald-300">
                            {n.avgPricePerSqM.toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">النمو السنوي:</span>
                          <span className="font-bold text-amber-300 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            +{n.yoyAppreciationPercent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Detailed Neighborhood Profile */}
            {selectedNeighborhood && (
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
                  {/* Image & Header */}
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/8] bg-slate-800">
                    <img
                      src={selectedNeighborhood.heroImage}
                      alt={selectedNeighborhood.nameAr}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div className="absolute bottom-4 right-4 left-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
                      <div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950">
                          مؤشر جودة الحياة {selectedNeighborhood.overallLivabilityScore} من 100
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                          {selectedNeighborhood.nameAr}
                        </h2>
                      </div>
                      <button
                        onClick={() => setShowReviewModal(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>أضف تقييمك للحي</span>
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                    {selectedNeighborhood.descriptionAr}
                  </p>

                  {/* 5-Star Multi-dimensional Community Ratings */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span>تقييمات السكان الحقيقية (أبعاد جودة الحياة)</span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: "الهدوء والسكينة", score: selectedNeighborhood.ratings.quietness, icon: Trees },
                        { label: "الخدمات والمرافق", score: selectedNeighborhood.ratings.services, icon: ShoppingBag },
                        { label: "المدارس والجامعات", score: selectedNeighborhood.ratings.schools, icon: School },
                        { label: "الأمان والنظافة", score: selectedNeighborhood.ratings.safety, icon: ShieldCheck },
                        { label: "المواصلات والمحاور", score: selectedNeighborhood.ratings.transportation, icon: Car },
                        { label: "المساحات الخضراء", score: selectedNeighborhood.ratings.greenSpaces, icon: Trees },
                      ].map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <div key={idx} className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                              <span className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5 text-emerald-400" />
                                {item.label}
                              </span>
                              <span className="text-amber-300 font-black flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {item.score}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                                style={{ width: `${(item.score / 5) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Landmarks and Top Compounds */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>أبرز المجمعات والكمبوندات:</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNeighborhood.topCompounds.map((c, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800/80 text-slate-200">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>أبرز المعالم والخدمات:</span>
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedNeighborhood.keyLandmarks.map((lm, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800/80 text-emerald-300">
                            {lm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Resident Reviews Feed */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>آراء وتجارب المقيمين ({selectedNeighborhood.reviews.length})</span>
                      </h3>
                      <span className="text-xs text-slate-400">تقييمات موثقة من سكان الحي</span>
                    </div>

                    <div className="space-y-3">
                      {selectedNeighborhood.reviews.map((rev) => (
                        <div key={rev.id} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white">{rev.residentName}</span>
                              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                ساكن بالحي منذ {rev.yearsOfResidency} سنوات
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400" />
                              ))}
                              <span className="text-[10px] text-slate-400 mr-1">{rev.date}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium">
                            "{rev.comment}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {showReviewModal && selectedNeighborhood && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-white">تقييم السكن في {selectedNeighborhood.nameAr}</h3>
                <p className="text-xs text-slate-400">شارك رأيك الحقيقي لمساعدة الباحثين عن سكن واستثمار</p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {reviewSuccess ? (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">شكراً لمشاركتك!</h4>
                <p className="text-xs text-slate-300">تم حفظ تقييمك للحي بنجاح وسيظهر للجميع.</p>
              </div>
            ) : (
              <form onSubmit={handleAddReview} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-300 mb-1">اسمك الكريم:</label>
                  <input
                    type="text"
                    required
                    value={residentName}
                    onChange={(e) => setResidentName(e.target.value)}
                    placeholder="مثال: م. أحمد عبد الفتاح"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-hidden font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">سنوات السكن بالحي:</label>
                    <select
                      value={yearsOfResidency}
                      onChange={(e) => setYearsOfResidency(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs outline-hidden"
                    >
                      <option value={1}>سنة واحدة</option>
                      <option value={2}>سنتان</option>
                      <option value={3}>3 - 5 سنوات</option>
                      <option value={7}>أكثر من 5 سنوات</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">التقييم العام (1 - 5):</label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs outline-hidden"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (ممتاز جداً)</option>
                      <option value={4}>⭐⭐⭐⭐ (جيد جداً)</option>
                      <option value={3}>⭐⭐⭐ (متوسط)</option>
                      <option value={2}>⭐⭐ (ضعيف)</option>
                      <option value={1}>⭐ (سيء)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">رأيك وتجربتك المعيشية:</label>
                  <textarea
                    required
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="اكتب عن الهدوء، الخدمات، سهولة المشاوير، وأي ملاحظات تهم الساكن الجديد..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-hidden font-medium"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>نشر تقييم الحي</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
