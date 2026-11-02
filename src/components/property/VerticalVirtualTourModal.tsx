"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MapPin,
  MessageCircle,
  Phone,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface VirtualTourProperty {
  id: string;
  title: string;
  price: number;
  slug?: string;
  addressDetails?: string;
  images: string[];
  category?: string;
  transactionType?: string;
  advertiserPhone?: string;
}

interface VerticalVirtualTourModalProps {
  property: VirtualTourProperty | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VerticalVirtualTourModal({
  property,
  isOpen,
  onClose,
}: VerticalVirtualTourModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Auto-advance virtual slideshow like Stories / Reels
  useEffect(() => {
    if (!isOpen || !property || !isPlaying) return;
    const images = property.images || [];
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3800);

    return () => clearInterval(timer);
  }, [isOpen, property, isPlaying]);

  // Reset index when property changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsPlaying(true);
  }, [property?.id]);

  if (!isOpen || !property) return null;

  const images = property.images && property.images.length > 0
    ? property.images
    : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"];

  const currentImg = images[currentImageIndex] || images[0];
  const phone = property.advertiserPhone || "01000000000";
  const waLink = `https://wa.me/2${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار عن العقار: "${property.title}" المعروض على دار العقار.`
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* 9:16 Vertical Reel / Story Frame */}
      <div className="relative w-full h-full sm:max-w-md sm:h-[88vh] sm:rounded-3xl overflow-hidden bg-slate-950 shadow-2xl flex flex-col justify-between select-none">
        {/* Background Visual (Image with Ken-Burns pan effect) */}
        <div className="absolute inset-0 z-0">
          <img
            key={currentImg}
            src={currentImg}
            alt={property.title}
            className="w-full h-full object-cover transition-all duration-700 scale-105"
          />
          {/* Gradient shading for high readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/70" />
        </div>

        {/* Top Story Header & Progress Bars */}
        <div className="relative z-10 p-4 space-y-3">
          {/* Story Progress Indicators */}
          <div className="flex items-center gap-1.5 w-full">
            {images.map((_, idx) => (
              <div
                key={idx}
                className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
              >
                <div
                  className={`h-full bg-white transition-all duration-300 ${
                    idx < currentImageIndex
                      ? "w-full"
                      : idx === currentImageIndex
                      ? "w-full"
                      : "w-0"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Top Controls Bar */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-brand-600/90 text-white text-[11px] font-black flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>معاينة افتراضية 🎥</span>
              </span>
              <span className="text-xs text-white/80 font-mono font-bold">
                {currentImageIndex + 1} / {images.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                title="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tap Zones (Left / Right) */}
        <div className="relative z-10 flex-1 flex items-center justify-between px-3">
          <button
            type="button"
            onClick={() =>
              setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
            }
            className="p-2 rounded-full bg-black/30 hover:bg-black/60 text-white/90 backdrop-blur-xs transition-all active:scale-90"
            title="الصورة السابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentImageIndex((prev) => (prev + 1) % images.length)
            }
            className="p-2 rounded-full bg-black/30 hover:bg-black/60 text-white/90 backdrop-blur-xs transition-all active:scale-90"
            title="الصورة التالية"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Details & Quick Action CTA */}
        <div className="relative z-10 p-5 space-y-3 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="space-y-1 text-white">
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {property.price?.toLocaleString("ar-EG")} <span className="text-xs">ج.م</span>
            </div>
            <h3 className="font-black text-base line-clamp-2 leading-snug">
              {property.title}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">{property.addressDetails || "ميت غمر، الدقهلية"}</span>
            </div>
          </div>

          {/* Quick CTA Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>واتساب فوري</span>
            </a>

            <a
              href={`tel:${phone}`}
              className="py-3 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
            >
              <Phone className="w-4 h-4 text-brand-600" />
              <span>اتصال هاتفي</span>
            </a>
          </div>

          {property.slug && (
            <Link
              href={`/properties/${property.slug}`}
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>عرض صفحة العقار بالكامل</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
