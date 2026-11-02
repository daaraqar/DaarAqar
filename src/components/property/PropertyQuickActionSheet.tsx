"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Share2,
  Phone,
  MessageCircle,
  Heart,
  Scale,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { PublicProperty } from "@/lib/db/types";
import { isPropertyOwnedByUser } from "@/lib/utils/propertyOwnership";

interface PropertyQuickActionSheetProps {
  property: PublicProperty | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (propertyId: string) => void;
  onOpenVirtualTour?: (property: PublicProperty) => void;
}

export default function PropertyQuickActionSheet({
  property,
  isOpen,
  onClose,
  isFavorited = false,
  onToggleFavorite,
  onOpenVirtualTour,
}: PropertyQuickActionSheetProps) {
  const [copied, setCopied] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setViewerLoaded(false);
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Auth request failed with status ${response.status}`);
        const data = await response.json();
        if (isMounted) {
          setViewerId(data.user?.id || null);
          setViewerLoaded(true);
        }
      })
      .catch((error: unknown) => {
        console.warn("[PropertyQuickActionSheet] Could not load current user:", error);
        if (isMounted) setViewerId(null);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, property?.id]);

  if (!isOpen || !property) return null;
  const isOwner = viewerLoaded && isPropertyOwnedByUser(property, viewerId);

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://aqarpulse.eg";
  const propertyUrl = `${appOrigin}/properties/${property.slug || property.id}`;

  const phone = property.advertiser?.phone || (property as any).advertiserPhone || "01000000000";
  const waShareText = `عقار مميز في ميت غمر على دار العقار:\n"${property.title}"\nالسعر: ${property.price?.toLocaleString("ar-EG")} ج.م\nالرابط: ${propertyUrl}`;
  const waShareLink = `https://wa.me/?text=${encodeURIComponent(waShareText)}`;
  const directWaAdvertiserLink = `https://wa.me/2${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار عن العقار: "${property.title}" (${propertyUrl})`
  )}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(propertyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      {/* Bottom Sheet Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom duration-300"
      >
        {/* Drag handle for mobile */}
        <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto -mt-2 mb-2 sm:hidden" />

        {/* Header Preview */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              <img
                src={property.images[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&q=80"}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-black text-slate-900 text-sm line-clamp-1">{property.title}</h3>
              <div className="text-xs font-bold text-brand-700 font-mono">
                {property.price?.toLocaleString("ar-EG")} ج.م
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {property.addressDetails || "ميت غمر، الدقهلية"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons List */}
        <div className="space-y-2 text-xs font-bold">
          {/* 1. Virtual Tour (One-Tap) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenVirtualTour) onOpenVirtualTour(property);
            }}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 hover:from-brand-100 hover:to-indigo-100 text-brand-900 border border-brand-200 flex items-center justify-between transition-all group active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block font-black text-sm">المعاينة الافتراضية بنقرة واحدة 🎥</span>
                <span className="text-[10px] text-slate-500 font-medium">جولة مصورة سريعة بالهاتف</span>
              </div>
            </div>
            <span className="text-brand-600 group-hover:-translate-x-1 transition-transform">&larr;</span>
          </button>

          {/* 2. Direct WhatsApp Share */}
          <a
            href={waShareLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 border border-emerald-200 flex items-center justify-between transition-all group active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block font-black text-sm">مشاركة سريعة عبر واتساب</span>
                <span className="text-[10px] text-emerald-800 font-medium">أرسل تفاصيل العقار لأصدقائك أو عائلتك</span>
              </div>
            </div>
            <span className="text-emerald-700 group-hover:-translate-x-1 transition-transform">&larr;</span>
          </a>

          {/* 3. Direct contact with advertiser */}
          {viewerLoaded && !isOwner && (
            <a
              href={directWaAdvertiserLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-between transition-all active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="block font-bold">اتصال هاتفي بالمعلن</span>
                  <span className="text-[10px] text-slate-400 font-medium font-mono">{phone}</span>
                </div>
              </div>
              <span className="text-slate-400">&larr;</span>
            </a>
          )}

          {/* 4. Compare with another property */}
          <Link
            href={`/compare?property=${property.id}`}
            onClick={onClose}
            className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-between transition-all active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
                <Scale className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block font-bold">مقارنة مع عقار آخر</span>
                <span className="text-[10px] text-slate-400 font-medium">مقارنة الأسعار والمواصفات وجهاً لوجه</span>
              </div>
            </div>
            <span className="text-slate-400">&larr;</span>
          </Link>

          {/* 5. Favorite & Copy Link Strip */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onToggleFavorite) onToggleFavorite(property.id);
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isFavorited
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? "fill-rose-600 text-rose-600" : ""}`} />
              <span>{isFavorited ? "في المفضلة ✓" : "حفظ بالمفضلة"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "تم النسخ!" : "نسخ الرابط"}</span>
            </button>
          </div>
        </div>

        {/* View Full Page CTA */}
        <Link
          href={`/properties/${property.slug || property.id}`}
          onClick={onClose}
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 transition-all active:scale-98 block text-center"
        >
          <span>فتح صفحة العقار الكاملة</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
