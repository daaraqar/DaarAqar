"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AqarReelsItem } from "@/lib/types/smartFeatures";
import {
  Sparkles,
  Heart,
  Eye,
  Share2,
  Building2,
  Phone,
  MessageCircle,
  ArrowRight,
  Loader2,
  Play,
  Pause,
} from "lucide-react";

export default function AqarReelsPage() {
  const [reels, setReels] = useState<AqarReelsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-features/reels");
      const data = await res.json();
      if (data.reels) {
        setReels(data.reels);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = (id: string) => {
    setLikedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            الميزة رقم 26: نبض ريلز (AqarReels)
          </span>
          <span className="text-xs text-slate-400">جولات المعاينة السريعة</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">جولات الفيديو العقارية القصيرة</h1>
        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
          شاهد الوحدات الفاخرة والشقق والكمبوندات بجولات حية واقعية دون الحاجة للانتقال من مكانك.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <span className="text-xs text-slate-500">جاري تحميل جولات الفيديو...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reels.map((reel) => {
            const isLiked = likedIds[reel.id];
            return (
              <div
                key={reel.id}
                className="bg-slate-950 rounded-3xl overflow-hidden border border-slate-850 shadow-2xl relative flex flex-col group"
              >
                {/* Video / Visual container */}
                <div className="relative aspect-[9/16] max-h-[580px] w-full bg-slate-900 overflow-hidden">
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40"></div>

                  {/* Top Stats */}
                  <div className="absolute top-4 right-4 left-4 flex items-center justify-between text-xs text-white">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md font-mono flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                      <span>{reel.viewsCount.toLocaleString("ar-EG")}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/80 font-bold text-[11px]">
                      معاينة حية
                    </span>
                  </div>

                  {/* Side Actions (Like / Share) */}
                  <div className="absolute bottom-24 left-4 flex flex-col items-center gap-3 z-20">
                    <button
                      onClick={() => handleLike(reel.id)}
                      className={`w-11 h-11 rounded-full flex flex-col items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer backdrop-blur-md ${
                        isLiked ? "bg-rose-600 text-white" : "bg-black/60 text-white hover:bg-black/80"
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? "fill-white" : ""}`} />
                    </button>
                    <span className="text-[11px] font-bold text-white font-mono">
                      {(reel.likesCount + (isLiked ? 1 : 0)).toLocaleString("ar-EG")}
                    </span>

                    <button
                      onClick={() => {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url);
                        alert("تم نسخ رابط جولة الفيديو لمشاركتها!");
                      }}
                      className="w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer backdrop-blur-md"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Bottom Overlay Card */}
                  <div className="absolute bottom-4 right-4 left-18 z-10 text-white space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {reel.tags.map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-[10px] font-bold">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-sm font-black text-white leading-snug drop-shadow-md">
                      {reel.title}
                    </h3>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {reel.price.toLocaleString("ar-EG")} ج.م
                    </div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-1">
                      <span>بواسطة:</span>
                      <strong className="text-white">{reel.advertiserName}</strong>
                    </div>

                    <div className="pt-2">
                      <Link
                        href={`/properties/${reel.propertyId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs transition-colors shadow-md"
                      >
                        <span>طلب المعاينة والتفاصيل</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
