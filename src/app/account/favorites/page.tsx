"use client";

import React, { useState, useEffect } from "react";
import PropertyCard from "@/components/property/PropertyCard";
import { PublicProperty } from "@/lib/db/types";
import { Heart, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function AccountFavoritesPage() {
  const [favorites, setFavorites] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites();

    const handleFavEvent = () => {
      fetchFavorites(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("favorites-updated", handleFavEvent);
      return () => window.removeEventListener("favorites-updated", handleFavEvent);
    }
  }, []);

  const fetchFavorites = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch("/api/favorites", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.favorites)) {
        throw new Error(data.error || "تعذر تحميل قائمة المفضلة");
      }
      setFavorites(data.favorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل قائمة المفضلة");
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
    }
  };

  const handleToggle = async (propId: string) => {
    const previous = [...favorites];
    setFavorites((prev) => prev.filter((p) => p.id !== propId));

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: propId, isFavorited: false }),
      });
      const data = await res.json();
      if (!res.ok || data.isFavorited !== false) {
        throw new Error(data.error || "تعذر إزالة العقار من المفضلة");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("favorites-updated", {
            detail: { propertyId: propId, isFavorited: false },
          })
        );
      }
    } catch (error) {
      setFavorites(previous);
      setError(error instanceof Error ? error.message : "تعذر إزالة العقار من المفضلة");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 sm:pb-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-600 fill-rose-600" />
            <span>العقارات المفضلة</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            قائمة العقارات التي حفظتها للرجوع إليها ومقارنتها
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchFavorites(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs active:scale-95"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || loading ? "animate-spin text-brand-600" : ""}`} />
            <span>تحديث</span>
          </button>

          <Link
            href="/explore"
            className="text-xs font-bold text-brand-700 hover:text-brand-800"
          >
            استكشاف المزيد على الخريطة
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          <span>{error}</span>
          {error.includes("سجّل الدخول") && (
            <Link
              href={`/login?redirect=${encodeURIComponent("/account/favorites")}`}
              className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white"
            >
              تسجيل الدخول
            </Link>
          )}
          <button
            type="button"
            onClick={() => void fetchFavorites(false)}
            className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-black"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-xs font-bold">جاري تحميل المفضلة...</span>
        </div>
      ) : error && favorites.length === 0 ? null : favorites.length === 0 ? (
        <div className="py-16 bg-white rounded-3xl border border-slate-200 text-center p-6 space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">لا توجد عقارات في قائمتك المفضلة حالياً</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            انقر على أيقونة القلب على أي بطاقة عقار لحفظه هنا للمقارنة لاحقاً.
          </p>
          <Link
            href="/explore"
            className="inline-block px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700"
          >
            تصفح الخريطة
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((prop) => (
            <PropertyCard
              key={prop.id}
              property={prop}
              isFavorited={true}
              onToggleFavorite={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
