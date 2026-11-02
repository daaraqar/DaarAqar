"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { PublicProperty } from "@/lib/db/types";
import {
  Heart,
  Bed,
  Bath,
  Maximize2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Phone,
  MessageCircle,
  MoreVertical,
  Video,
} from "lucide-react";
import VerticalVirtualTourModal from "./VerticalVirtualTourModal";
import PropertyQuickActionSheet from "./PropertyQuickActionSheet";

interface PropertyCardProps {
  property: PublicProperty;
  isSelected?: boolean;
  onHover?: (property: PublicProperty | null) => void;
  onClick?: (property: PublicProperty) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (propertyId: string) => void;
}

const CATEGORY_NAMES_AR: Record<string, string> = {
  apartment: "شقق سكنية",
  house: "بيوت ومنازل",
  land: "أراضي (بناء / زراعية)",
  commercial_retail: "محلات ومتاجر",
  office: "مكاتب ومقرات إدارية",
  villa: "فلل وقصور",
  townhouse: "بيوت ومنازل",
  twin_house: "فلل وقصور",
  duplex: "شقق سكنية",
  penthouse: "شقق سكنية",
  chalet: "شقق سكنية",
  studio: "شقق سكنية",
  clinic: "مكاتب ومقرات إدارية",
};

export default function PropertyCard({
  property,
  isSelected = false,
  onHover,
  onClick,
  isFavorited = false,
  onToggleFavorite,
}: PropertyCardProps) {
  const [favorited, setFavorited] = useState(isFavorited);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [showQuickActionSheet, setShowQuickActionSheet] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowQuickActionSheet(true);
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    setFavorited(isFavorited);
  }, [isFavorited]);

  React.useEffect(() => {
    const handleFavEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        (customEvent.detail.propertyId === property.id || customEvent.detail.propertyId === property.slug)
      ) {
        setFavorited(customEvent.detail.isFavorited);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("favorites-updated", handleFavEvent);
      return () => window.removeEventListener("favorites-updated", handleFavEvent);
    }
  }, [property.id, property.slug]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (favoriteLoading) return;

    const nextState = !favorited;
    setFavorited(nextState);

    if (onToggleFavorite) {
      onToggleFavorite(property.id);
      return;
    }

    setFavoriteLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, isFavorited: nextState }),
      });
      if (res.status === 401) {
        setFavorited(false);
        if (typeof window !== "undefined") {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
      } else if (!res.ok) {
        setFavorited(!nextState);
      } else {
        const data = await res.json();
        if (typeof data.isFavorited === "boolean") {
          setFavorited(data.isFavorited);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("favorites-updated", {
              detail: { propertyId: property.id, isFavorited: data.isFavorited },
            })
          );
        }
      }
    } catch {
      setFavorited(!nextState);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const isSale = property.transactionType === "sale";
  const categoryLabel = CATEGORY_NAMES_AR[property.category] || property.category;
  const advertiserName = property.advertiser?.name || "معلن";
  const advertiserRole = property.advertiser?.role || property.advertiserType || "owner";

  return (
    <div
      onClick={() => onClick && onClick(property)}
      onMouseEnter={() => onHover && onHover(property)}
      onMouseLeave={() => onHover && onHover(null)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`group relative flex flex-col bg-white rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
        isSelected
          ? "border-amber-500 shadow-xl ring-2 ring-amber-400/40 -translate-y-1"
          : "border-slate-200 hover:border-brand-500 hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      {/* Property Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Image
          src={property.images[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"}
          alt={property.title}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-black/20" />

        {/* Top Badges & Actions Strip */}
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm ${
                isSale ? "bg-brand-600" : "bg-blue-600"
              }`}
            >
              {isSale ? "للبيع" : "للإيجار"}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/70 text-slate-100 backdrop-blur-sm shadow-sm">
              {categoryLabel}
            </span>
            {property.featured && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shadow-sm">
                <Sparkles className="w-3 h-3" />
                مميز
              </span>
            )}
          </div>

          {/* Quick Actions (Virtual Tour + Favorite + Quick Action Sheet) */}
          <div className="flex items-center gap-1.5">
            {/* One-Tap Virtual Tour Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowVirtualTour(true);
              }}
              className="pointer-events-auto px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-slate-900 text-amber-300 font-black text-[11px] shadow-md backdrop-blur-sm transition-all flex items-center gap-1 active:scale-90"
              title="معاينة افتراضية بنقرة واحدة (Reels Style)"
            >
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span>جولة 🎥</span>
            </button>

            {/* Favorite Toggle Button */}
            <button
              type="button"
              onClick={handleFavoriteClick}
              className="pointer-events-auto p-2 rounded-full bg-white/85 hover:bg-white text-slate-700 hover:text-rose-600 shadow-md backdrop-blur-sm transition-all active:scale-90"
              title={favorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  favorited ? "fill-rose-600 text-rose-600" : "text-slate-700"
                }`}
              />
            </button>

            {/* Quick Action Sheet Trigger (•••) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowQuickActionSheet(true);
              }}
              className="pointer-events-auto p-2 rounded-full bg-white/85 hover:bg-white text-slate-700 shadow-md backdrop-blur-sm transition-all active:scale-90"
              title="خيارات ومشاركة سريعة"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Price in Image */}
        <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between text-white">
          <div>
            <div className="text-xl font-extrabold tracking-tight drop-shadow-md">
              {property.price.toLocaleString("ar-EG")} <span className="text-sm font-bold text-brand-200">ج.م</span>
              {property.rentalPeriod && (
                <span className="text-xs font-medium text-slate-300"> / شهرياً</span>
              )}
            </div>
            {property.downPayment && (
              <div className="text-[11px] text-slate-200 font-medium">
                مقدم: {property.downPayment.toLocaleString("ar-EG")} ج.م • تقسيط {property.installmentYears} سنوات
              </div>
            )}
          </div>

          {/* Location Privacy Indicator */}
          {property.isApproximateLocation && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-slate-950 backdrop-blur-xs">
              موقع تقريبي
            </span>
          )}
        </div>
      </div>

      {/* Property Details Body */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title */}
        <Link
          href={`/properties/${property.slug}`}
          className="text-base font-bold text-slate-900 line-clamp-1 hover:text-brand-700 transition-colors mb-1.5"
        >
          {property.title}
        </Link>

        {/* Address */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span>{property.addressDetails || "ميت غمر، الدقهلية"}</span>
        </div>

        {/* Specifications Strip */}
        <div className="flex items-center gap-4 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 font-medium mb-3">
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{property.areaSqM} م²</span>
          </div>
          {property.bedrooms !== undefined && (
            <div className="flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bedrooms} غرف</span>
            </div>
          )}
          {property.bathrooms !== undefined && (
            <div className="flex items-center gap-1.5">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.bathrooms} حمام</span>
            </div>
          )}
        </div>

        {/* Advertiser Footer */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-[10px]">
              {advertiserName.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800 line-clamp-1">
                {advertiserName}
              </span>
              <span className="text-[10px] text-slate-400">
                {advertiserRole === "broker" ? "وسيط عقاري" : "المالك مباشرة"}
              </span>
            </div>
          </div>

          <Link
            href={`/properties/${property.slug}`}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-600 hover:text-white text-slate-700 font-bold text-xs transition-colors"
          >
            التفاصيل
          </Link>
        </div>
      </div>

      {/* 1. One-Tap Virtual Tour Modal (Reels Style) */}
      {showVirtualTour && (
        <VerticalVirtualTourModal
          property={{
            id: property.id,
            title: property.title,
            price: property.price,
            slug: property.slug,
            addressDetails: property.addressDetails,
            images: property.images,
            category: property.category,
            transactionType: property.transactionType,
            advertiserPhone: property.advertiser?.phone,
          }}
          isOpen={showVirtualTour}
          onClose={() => setShowVirtualTour(false)}
        />
      )}

      {/* 2. Quick Action Sheet (Mobile long-press & •••) */}
      {showQuickActionSheet && (
        <PropertyQuickActionSheet
          property={property}
          isOpen={showQuickActionSheet}
          onClose={() => setShowQuickActionSheet(false)}
          isFavorited={favorited}
          onToggleFavorite={onToggleFavorite}
          onOpenVirtualTour={() => {
            setShowQuickActionSheet(false);
            setShowVirtualTour(true);
          }}
        />
      )}
    </div>
  );
}
