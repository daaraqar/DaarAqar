"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Share2,
  Heart,
  Camera,
  Building,
  Grid,
  Banknote,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Video,
  MapPin,
  SlidersHorizontal,
  AlignJustify,
  ExternalLink,
  Footprints,
  Bus,
  Bike,
  Loader2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Car,
  Wind,
  PhoneCall,
  Flame,
  Waves,
  Briefcase,
  Store,
  Layers,
  Lock,
} from "lucide-react";
import RegisterInterestModal from "./RegisterInterestModal";
import ProjectPhotoGalleryModal from "./ProjectPhotoGalleryModal";

const ProjectLocationMap = dynamic(() => import("./ProjectLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
      جاري تحميل الخريطة...
    </div>
  ),
});

const PROJECT_TRAVEL_MODES = [
  { id: "driving", label: "سيارة", directionsLabel: "السيارة", icon: Car },
  { id: "walking", label: "مشياً", directionsLabel: "المشي", icon: Footprints },
  { id: "transit", label: "مواصلات", directionsLabel: "المواصلات", icon: Bus },
  { id: "bicycling", label: "دراجة", directionsLabel: "الدراجة", icon: Bike },
] as const;

type ProjectTravelMode = (typeof PROJECT_TRAVEL_MODES)[number]["id"];

export interface ProjectShowcaseData {
  id: string;
  title: string;
  status?: string;
  developerName?: string;
  developerLogo?: string;
  locationText: string;
  city: string;
  lat: number;
  lng: number;
  tags: string[];
  totalUnitsCount: number;
  minAreaSqM: number;
  maxAreaSqM: number;
  minPrice: number;
  maxPrice: number;
  currency: string;
  description: string;
  amenities: Array<{ key: string; label: string; icon?: string }>;
  nearbyLandmarks: Array<{ name: string; distanceKm: number }>;
  images: string[];
  subUnits: Array<{
    id: string;
    title: string;
    price: number;
    areaSqM: number;
    category?: string;
    bedrooms?: number;
    image: string;
    locationText: string;
  }>;
}

export const DEFAULT_OWJ_KHOBAR_PROJECT: ProjectShowcaseData = {
  id: "meet-ghamr-sample",
  title: "مشروع ميت غمر النموذجي",
  developerName: "شركة أوج العقارية",
  developerLogo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&q=80",
  locationText: "مدينة ميت غمر، مركز ميت غمر، الدقهلية",
  city: "مركز ميت غمر",
  lat: 30.7194,
  lng: 31.258,
  tags: ["متاح", "مكاتب للإيجار", "محل للإيجار", "وحدات جاهزة"],
  totalUnitsCount: 18,
  minAreaSqM: 325,
  maxAreaSqM: 2100,
  minPrice: 70000,
  maxPrice: 290000,
  currency: "جنيه مصري",
  description:
    "مشروع عقاري في مركز ميت غمر، يضم وحدات متنوعة بمساحات وأسعار مختلفة. تواصل مع المعلن للتفاصيل ومواعيد المعاينة.",
  amenities: [
    { key: "security_cameras", label: "كاميرا الأمن" },
    { key: "security_guard", label: "حارس أمن" },
    { key: "elevator", label: "مصعد" },
    { key: "near_services", label: "قريب من الخدمات" },
    { key: "dedicated_parking", label: "مواقف مخصصة" },
    { key: "visitor_reception", label: "منطقة استقبال الزوار" },
    { key: "free_maintenance", label: "صيانة مجانية" },
    { key: "receptionist", label: "موظف استقبال" },
    { key: "field_management", label: "إدارة ميدانية للصيانة" },
  ],
  nearbyLandmarks: [
    { name: "وسط مدينة ميت غمر", distanceKm: 0 },
  ],
  images: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80",
    "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&q=80",
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1200&q=80",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
  ],
  subUnits: [
    {
      id: "unit-1",
      title: "محل للإيجار",
      price: 290000,
      areaSqM: 325,
      category: "commercial",
      image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80",
      locationText: "مدينة ميت غمر، مركز ميت غمر",
    },
    {
      id: "unit-2",
      title: "مكتب تجاري للإيجار",
      price: 70000,
      areaSqM: 2100,
      category: "office",
      bedrooms: 2,
      image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=500&q=80",
      locationText: "مدينة ميت غمر، مركز ميت غمر",
    },
  ],
};

interface ProjectShowcaseViewProps {
  project?: ProjectShowcaseData;
}

export default function ProjectShowcaseView({ project = DEFAULT_OWJ_KHOBAR_PROJECT }: ProjectShowcaseViewProps) {
  const router = useRouter();
  const isDemoProject = project.id === "meet-ghamr-sample";
  const [isLiked, setIsLiked] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<ProjectTravelMode>("driving");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isInterestModalOpen, setIsInterestModalOpen] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [selectedUnitForInquiry, setSelectedUnitForInquiry] = useState<string>("");
  const [activeUnitCategory, setActiveUnitCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    setIsLiked(false);
    setFavoriteError(null);
    if (isDemoProject) {
      setFavoriteLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setFavoriteLoading(true);
    fetch(`/api/favorites?propertyId=${encodeURIComponent(project.id)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) return;
        if (!response.ok || typeof result.isFavorited !== "boolean") {
          throw new Error(result.error || "تعذر التحقق من حالة المفضلة");
        }
        if (!cancelled) setIsLiked(result.isFavorited);
      })
      .catch((error) => {
        if (!cancelled) {
          setFavoriteError(error instanceof Error ? error.message : "تعذر التحقق من حالة المفضلة");
        }
      })
      .finally(() => {
        if (!cancelled) setFavoriteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemoProject, project.id]);

  const heroImage = project.images[0] || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80";
  const displayedAmenities = showAllAmenities ? project.amenities : project.amenities.slice(0, 3);

  // Filter & Sort sub-units
  const filteredSubUnits = project.subUnits
    .filter((u) => {
      if (activeUnitCategory === "all") return true;
      if (activeUnitCategory === "commercial") return u.title.includes("محل") || u.category === "commercial";
      if (activeUnitCategory === "office") return u.title.includes("مكتب") || u.category === "office";
      return true;
    })
    .sort((a, b) => (sortOrder === "desc" ? b.price - a.price : a.price - b.price));

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: project.title,
          text: `${project.title} - ${project.locationText}`,
          url: window.location.href,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    }
  };

  const toggleProjectFavorite = async () => {
    if (favoriteLoading) return;
    const nextState = !isLiked;
    setIsLiked(nextState);
    setFavoriteLoading(true);
    setFavoriteError(null);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: project.id, isFavorited: nextState }),
      });
      const result = await response.json();
      if (response.status === 401) {
        setIsLiked(false);
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok || result.isFavorited !== nextState) {
        throw new Error(result.error || "تعذر تحديث المفضلة");
      }
      window.dispatchEvent(
        new CustomEvent("favorites-updated", {
          detail: { propertyId: project.id, isFavorited: nextState },
        })
      );
    } catch (error) {
      setIsLiked(!nextState);
      setFavoriteError(error instanceof Error ? error.message : "تعذر تحديث المفضلة");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const calculateRouteFromCurrentLocation = () => {
    if (!Number.isFinite(project.lat) || !Number.isFinite(project.lng)) {
      setRouteError("إحداثيات موقع المشروع غير صالحة لحساب المسار.");
      return;
    }
    if (!navigator.geolocation) {
      setRouteError("متصفحك لا يدعم تحديد الموقع الحالي.");
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const origin = { lat: coords.latitude, lng: coords.longitude };
        setCurrentLocation(origin);

        try {
          const routingBaseUrl = (
            process.env.NEXT_PUBLIC_OSRM_ROUTING_URL || "https://router.project-osrm.org"
          ).replace(/\/+$/, "");
          const routeUrl = new URL(
            `${routingBaseUrl}/route/v1/driving/${origin.lng},${origin.lat};${project.lng},${project.lat}`
          );
          routeUrl.searchParams.set("overview", "full");
          routeUrl.searchParams.set("geometries", "geojson");
          routeUrl.searchParams.set("steps", "false");

          const response = await fetch(routeUrl, { signal: AbortSignal.timeout(15_000) });
          const result = await response.json();
          const route = result.routes?.[0];
          const rawCoordinates = route?.geometry?.coordinates;
          if (
            !response.ok ||
            result.code !== "Ok" ||
            !Array.isArray(rawCoordinates) ||
            rawCoordinates.length < 2
          ) {
            throw new Error("لم يتوفر مسار قيادة بين موقعك والمشروع.");
          }

          const coordinates = rawCoordinates.map((coordinate: unknown) => {
            if (
              !Array.isArray(coordinate) ||
              coordinate.length < 2 ||
              !Number.isFinite(Number(coordinate[0])) ||
              !Number.isFinite(Number(coordinate[1]))
            ) {
              throw new Error("أعادت خدمة التوجيه بيانات مسار غير صالحة.");
            }
            return [Number(coordinate[1]), Number(coordinate[0])] as [number, number];
          });
          const distanceMeters = Number(route.distance);
          const durationSeconds = Number(route.duration);
          if (
            !Number.isFinite(distanceMeters) ||
            distanceMeters < 0 ||
            !Number.isFinite(durationSeconds) ||
            durationSeconds < 0
          ) {
            throw new Error("أعادت خدمة التوجيه تقديرًا غير صالح للمسافة أو الزمن.");
          }

          setRouteCoordinates(coordinates);
          setRouteSummary({ distanceMeters, durationSeconds });
        } catch (error) {
          setRouteCoordinates([]);
          setRouteSummary(null);
          setRouteError(error instanceof Error ? error.message : "تعذر حساب المسار.");
        } finally {
          setRouteLoading(false);
        }
      },
      (error) => {
        setRouteError(
          error.code === error.PERMISSION_DENIED
            ? "اسمح بالوصول إلى موقعك لحساب المسار."
            : error.code === error.TIMEOUT
            ? "انتهت مهلة تحديد موقعك؛ حاول مرة أخرى."
            : "تعذر تحديد موقعك الحالي."
        );
        setRouteLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${project.lat},${project.lng}`
  )}&travelmode=${travelMode}`;

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-36 font-sans select-none" dir="rtl">
      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>تم نسخ رابط المشروع بنجاح!</span>
        </div>
      )}

      {/* Prominent Restricted Project Banner (منشور مقيد) */}
      {project.status === "pending_review" && (
        <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-black border-b border-amber-600">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 shrink-0" />
            <span>تنبيه: هذا المشروع منشور مقيد 🔒 وبانتظار موافقة إدارة المنصة (معاينة خاصة بالعميل)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-slate-950 text-amber-400 text-xs font-bold">
              قيد المراجعة والاعتماد
            </span>
            <Link
              href="/dashboard/properties?status=pending_review"
              className="px-3 py-1 rounded-full bg-white text-slate-900 text-xs font-black shadow-xs hover:bg-amber-100 transition"
            >
              العودة لقائمة المنشورات المقيدة
            </Link>
          </div>
        </div>
      )}

      {/* 1. Hero Photo Section */}
      <div className="relative w-full h-[360px] md:h-[420px] bg-slate-900 overflow-hidden">
        {/* Hero Background Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt={project.title}
          className="w-full h-full object-cover object-center"
        />

        {/* Subtle Dark Gradient at Top & Bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/40 pointer-events-none" />

        {/* Top Floating Action Buttons Bar */}
        <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20">
          {/* Back Button (Right in RTL) */}
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer backdrop-blur-xs"
            aria-label="الرجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Share & Favorite Buttons (Left in RTL) */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer backdrop-blur-xs"
              aria-label="مشاركة"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => void toggleProjectFavorite()}
              disabled={favoriteLoading || isDemoProject}
              aria-pressed={isLiked}
              className={`w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer backdrop-blur-xs disabled:cursor-wait disabled:opacity-60 ${
                isLiked ? "text-rose-500" : "text-slate-800"
              }`}
              aria-label={
                isDemoProject
                  ? "المشروع التجريبي غير متاح للحفظ"
                  : isLiked
                  ? "إزالة المشروع من المفضلة"
                  : "إضافة المشروع إلى المفضلة"
              }
              title={isDemoProject ? "المشروع التجريبي غير متاح للحفظ" : undefined}
            >
              <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* Bottom Right Floating Badge: "شاهد الصور (13)" */}
        <button
          onClick={() => setIsGalleryOpen(true)}
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md shadow-md border border-white/10 transition-transform active:scale-95 cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>شاهد الصور ({project.images.length})</span>
        </button>
      </div>
      {favoriteError && (
        <p role="alert" className="mx-4 mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {favoriteError}
        </p>
      )}

      {/* 2. Tags Bar Directly Below Image */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {project.tags.map((tag, idx) => {
            const isFirst = idx === 0;
            return (
              <span
                key={tag}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors ${
                  isFirst
                    ? "bg-sky-100 text-sky-700 border border-sky-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="px-4 py-5 space-y-7 max-w-lg mx-auto">
        {/* 3. Project Title, Developer Logo & Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {project.title}
            </h1>
            {/* Developer Logo Box */}
            <div className="w-14 h-9 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
              {project.developerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.developerLogo}
                  alt={project.developerName || "المطور"}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 leading-normal">
            {project.locationText}
          </p>
        </div>

        {/* 4. تفاصيل الوحدات المتوفرة (Available Units Breakdown) */}
        <div className="space-y-3 pt-1">
          <h2 className="text-sm font-black text-slate-800">تفاصيل الوحدات المتوفرة</h2>
          <div className="bg-slate-50/70 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {/* Row 1: عدد الوحدات */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="space-y-0.5 text-right">
                <span className="block text-xs text-slate-500 font-medium">عدد الوحدات</span>
                <span className="block text-sm font-bold text-slate-800">
                  {project.totalUnitsCount} وحدة
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                <Building className="w-4 h-4" />
              </div>
            </div>

            {/* Row 2: المساحات */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="space-y-0.5 text-right">
                <span className="block text-xs text-slate-500 font-medium">المساحات</span>
                <span className="block text-sm font-bold text-slate-800">
                  من {project.minAreaSqM.toLocaleString("ar-EG")} م2 إلى {project.maxAreaSqM.toLocaleString("ar-EG")} م2
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                <Grid className="w-4 h-4" />
              </div>
            </div>

            {/* Row 3: الأسعار */}
            <div className="p-3.5 flex items-center justify-between">
              <div className="space-y-0.5 text-right">
                <span className="block text-xs text-slate-500 font-medium">الأسعار</span>
                <span className="block text-sm font-bold text-slate-800">
                  من {project.minPrice.toLocaleString("ar-EG")} ج.م إلى {project.maxPrice.toLocaleString("ar-EG")} ج.م
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* 5. وصف العقار (Property Description) */}
        <div className="space-y-2">
          <h2 className="text-sm font-black text-slate-800">وصف العقار</h2>
          <div className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-line text-right">
            {project.description}
          </div>
        </div>

        {/* 6. مميزات المشروع (Project Amenities) */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-slate-800">مميزات المشروع</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayedAmenities.map((amenity) => (
              <div
                key={amenity.key}
                className="bg-slate-50/90 rounded-2xl border border-slate-100 p-3 flex items-center justify-between gap-2 shadow-2xs"
              >
                <span className="text-xs font-bold text-slate-700 truncate">{amenity.label}</span>
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                  {amenity.key.includes("camera") ? (
                    <Video className="w-3.5 h-3.5" />
                  ) : amenity.key.includes("guard") || amenity.key.includes("security") ? (
                    <Shield className="w-3.5 h-3.5" />
                  ) : amenity.key.includes("elevator") ? (
                    <Layers className="w-3.5 h-3.5" />
                  ) : amenity.key.includes("parking") ? (
                    <Car className="w-3.5 h-3.5" />
                  ) : amenity.key.includes("sea") ? (
                    <Waves className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {project.amenities.length > 3 && (
            <button
              onClick={() => setShowAllAmenities(!showAllAmenities)}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors pt-1 cursor-pointer"
            >
              <span>{showAllAmenities ? "عرض أقل" : "عرض المزيد"}</span>
              <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${showAllAmenities ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {/* 7. موقع المشروع وخيارات التنقل */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-slate-800">موقع المشروع والتنقل إليه</h2>
          <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm aspect-[16/10]">
            <ProjectLocationMap
              lat={project.lat}
              lng={project.lng}
              currentLocation={currentLocation}
              routeCoordinates={routeCoordinates}
            />
          </div>
          <button
            type="button"
            onClick={calculateRouteFromCurrentLocation}
            disabled={routeLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {routeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            <span>{routeLoading ? "جارٍ تحديد موقعك وحساب المسار..." : "اعرض مسار السيارة من موقعي داخل الخريطة"}</span>
          </button>
          <p className="text-[11px] leading-5 text-slate-500">
            عند طلب المسار سيطلب المتصفح إذن الموقع، وتُرسل إحداثيات البداية إلى خدمة التوجيه لحساب طريق السيارة. لا تُحفظ إحداثيات موقعك في حسابك.
          </p>
          {routeSummary && (
            <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
              المسافة التقريبية: {(routeSummary.distanceMeters / 1000).toFixed(1)} كم · الزمن المتوقع: {Math.max(1, Math.round(routeSummary.durationSeconds / 60))} دقيقة
            </p>
          )}
          {routeError && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {routeError}
            </p>
          )}
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="اختيار وسيلة التنقل">
            {PROJECT_TRAVEL_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={travelMode === id}
                onClick={() => setTravelMode(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors ${
                  travelMode === id
                    ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            <ExternalLink className="h-4 w-4" />
            <span>
              أو افتح اتجاهات {PROJECT_TRAVEL_MODES.find((mode) => mode.id === travelMode)?.directionsLabel} في Google Maps
            </span>
          </a>
          {project.nearbyLandmarks.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="truncate text-xs font-bold text-slate-700">
                {project.nearbyLandmarks[0].name}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-500">
                {project.nearbyLandmarks[0].distanceKm} كم
              </span>
            </div>
          )}
        </div>

        {/* 8. الوحدات (Units Listing) */}
        <div className="space-y-3 pt-2">
          {/* Section Header with Filter and Sort */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">الوحدات</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setActiveUnitCategory((prev) => (prev === "all" ? "commercial" : prev === "commercial" ? "office" : "all"))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>
                  فلترة {activeUnitCategory === "commercial" ? "(محلات)" : activeUnitCategory === "office" ? "(مكاتب)" : ""}
                </span>
              </button>
              <button
                onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="ترتيب الأسعار"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sub-Units Cards List */}
          <div className="space-y-3">
            {filteredSubUnits.map((unit) => (
              <div
                key={unit.id}
                onClick={() => {
                  setSelectedUnitForInquiry(unit.title);
                  setIsInterestModalOpen(true);
                }}
                className="bg-white rounded-2xl border border-slate-200 p-2.5 flex items-center justify-between gap-3 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer group"
              >
                {/* Right: Unit Thumbnail */}
                <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={unit.image}
                    alt={unit.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Left: Unit Details */}
                <div className="flex-1 space-y-1 text-right">
                  <h3 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {unit.title}
                  </h3>
                  <div className="text-sm font-black text-emerald-700">
                    {unit.price.toLocaleString("ar-EG")} ج.م
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Grid className="w-3 h-3 text-slate-400" />
                      <span>{unit.areaSqM} م²</span>
                    </span>
                    {unit.bedrooms && (
                      <span className="flex items-center gap-1">
                        <span>•</span>
                        <span>{unit.bedrooms} غرف</span>
                      </span>
                    )}
                    {unit.category && (
                      <span className="flex items-center gap-1">
                        <span>•</span>
                        <span>{unit.category === "commercial" ? "تجاري" : "إداري"}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{unit.locationText}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9. Floating Bottom Action Bar ("تسجيل اهتمام") */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 shadow-lg">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => {
              setSelectedUnitForInquiry("");
              setIsInterestModalOpen(true);
            }}
            className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>تسجيل اهتمام</span>
          </button>
        </div>
      </div>

      {/* Interactive Modals */}
      <RegisterInterestModal
        isOpen={isInterestModalOpen}
        onClose={() => setIsInterestModalOpen(false)}
        projectName={project.title}
        projectId={project.id}
        availableUnits={project.subUnits}
        defaultUnitTitle={selectedUnitForInquiry}
      />

      <ProjectPhotoGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        images={project.images}
        projectTitle={project.title}
      />
    </div>
  );
}
