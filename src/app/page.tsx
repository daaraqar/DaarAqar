"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import PropertyMap from "@/components/map/PropertyMap";
import OfficialNoticesList from "@/components/dashboard/OfficialNoticesList";
import InquiryForm from "@/app/properties/[slug]/InquiryForm";
import {
  PublicProperty,
  PropertyCategory,
  TransactionType,
  CATEGORY_LABELS_AR,
  OFFICIAL_PROPERTY_CATEGORIES,
} from "@/lib/db/types";
import {
  MapPin,
  Building2,
  Search,
  SlidersHorizontal,
  X,
  Home as HomeIcon,
  Layers,
  ChevronUp,
  ChevronDown,
  Navigation,
  Loader2,
  Phone,
  MessageCircle,
  Heart,
  Share2,
  Eye,
  CheckCircle2,
  Key,
  DoorClosed,
  List as ListIcon,
  Maximize2,
  Tag,
  ArrowRight,
  Sparkles,
  Compass,
  Shield,
  Crown,
  Star,
  Bell,
} from "lucide-react";
import type { CmsHomepageSettings, District } from "@/lib/db/types";
import { isPropertyOwnedByUser } from "@/lib/utils/propertyOwnership";
import { DEFAULT_BRAND_LOGO_PATH, getBrandLogoHeightPx } from "@/lib/brand-theme";
import { matchesSearchQuery } from "@/lib/search/property-search";

// Haversine distance formula in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} م`;
  }
  return `${(meters / 1000).toFixed(1)} كم`;
}

// Category filter chips matching Image 1
const CATEGORY_CHIPS = [
  { id: "all", label: "الكل" },
  ...OFFICIAL_PROPERTY_CATEGORIES.map(({ value, label }) => ({ id: value, label })),
];

export default function SaudiAqarApp() {
  const router = useRouter();

  // Primary view toggle: "map" (Image 1) or "list" (Image 2)
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // Filter States
  const [transactionType, setTransactionType] = useState<"sale" | "rent">("sale");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "price_asc" | "price_desc" | "nearest">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [geocodeSuggestions, setGeocodeSuggestions] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Map settings
  const [mapType, setMapType] = useState<"satellite" | "street">("street");
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.7194, 31.2580]);
  const [mapZoom, setMapZoom] = useState(13);
  const [autoFitKey, setAutoFitKey] = useState<number>(Date.now());

  // Properties & Selection
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const districtById = useMemo(
    () => new Map(districts.map((district) => [district.id, district])),
    [districts]
  );
  const [homepageSettings, setHomepageSettings] = useState<CmsHomepageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PublicProperty | null>(null);
  const [selectedPropertyFavorited, setSelectedPropertyFavorited] = useState(false);
  const [favoriteActionLoading, setFavoriteActionLoading] = useState(false);
  const [previewActionMessage, setPreviewActionMessage] = useState("");
  const selectedPropertyId = selectedProperty?.id;
  const [contactProperty, setContactProperty] = useState<PublicProperty | null>(null);
  const [unreadNoticesCount, setUnreadNoticesCount] = useState<number>(0);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [noticesRefreshTrigger, setNoticesRefreshTrigger] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);

  // User Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    const fetchUnreadNotices = async () => {
      try {
        const res = await fetch("/api/official-notices", { cache: "no-store", credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.notices)) {
            const unread = data.notices.filter((n: any) => n.status === "unread").length;
            setUnreadNoticesCount(unread);
          }
        }
      } catch {
        // Visitor or unauthorized
      }
    };
    fetchUnreadNotices();
    const interval = setInterval(fetchUnreadNotices, 30000);
    // Live sync: when the notifications panel marks notices read, update badge instantly
    const onNoticesSync = (e: Event) => {
      const count = (e as CustomEvent).detail;
      if (typeof count === "number") setUnreadNoticesCount(count);
    };
    window.addEventListener("aqar:unread-notices", onNoticesSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("aqar:unread-notices", onNoticesSync);
    };
  }, [noticesRefreshTrigger]);


  useEffect(() => {
    if (!selectedPropertyId) {
      setSelectedPropertyFavorited(false);
      setPreviewActionMessage("");
      return;
    }

    const controller = new AbortController();
    setSelectedPropertyFavorited(false);
    setPreviewActionMessage("");
    fetch(`/api/favorites?propertyId=${encodeURIComponent(selectedPropertyId)}`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) return;
        if (!response.ok || typeof result.isFavorited !== "boolean") {
          throw new Error(result.error || "تعذر تحميل حالة المفضلة");
        }
        if (!controller.signal.aborted) setSelectedPropertyFavorited(result.isFavorited);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setPreviewActionMessage(
            error instanceof Error ? error.message : "تعذر تحميل حالة المفضلة"
          );
        }
      });

    return () => controller.abort();
  }, [selectedPropertyId]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    properties.forEach(({ category }) => {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return counts;
  }, [properties]);

  const sortedCategoryChips = useMemo(
    () =>
      CATEGORY_CHIPS.map((chip, index) => ({ ...chip, index }))
        .sort((a, b) => {
          if (a.id === "all") return b.id === "all" ? 0 : -1;
          if (b.id === "all") return 1;
          return (categoryCounts.get(b.id) ?? 0) - (categoryCounts.get(a.id) ?? 0) || a.index - b.index;
        })
        .map(({ id, label }) => ({ id, label })),
    [categoryCounts]
  );

  const actualPriceBounds = { min: 500, max: 50_000_000 };
  const hasPriceBounds = true;
  const sliderMin = actualPriceBounds.min;
  const sliderMax = Math.max(actualPriceBounds.max, sliderMin + 1);
  const sliderStep = Math.max(1, Math.round((sliderMax - sliderMin) / 1000));
  const selectedMinPrice = minPrice === ""
    ? actualPriceBounds.min
    : Math.min(actualPriceBounds.max, Math.max(actualPriceBounds.min, Number(minPrice)));
  const selectedMaxPrice = maxPrice === ""
    ? actualPriceBounds.max
    : Math.min(actualPriceBounds.max, Math.max(actualPriceBounds.min, Number(maxPrice)));
  const minThumbValue = selectedMinPrice;
  const maxThumbValue = maxPrice === "" && actualPriceBounds.min === actualPriceBounds.max
    ? sliderMax
    : selectedMaxPrice;
  const minThumbPosition = ((minThumbValue - sliderMin) / (sliderMax - sliderMin)) * 100;
  const maxThumbPosition = ((maxThumbValue - sliderMin) / (sliderMax - sliderMin)) * 100;
  const formatPrice = (price: number) => `${Math.round(price).toLocaleString("ar-EG")} ج.م`;

  // Fetch properties from backend
  useEffect(() => {
    let isMounted = true;
    const loadProperties = async () => {
      try {
        const firstResponse = await fetch("/api/properties?limit=250&page=1");
        if (!firstResponse.ok) throw new Error(`Properties request failed (${firstResponse.status})`);
        const firstPage = await firstResponse.json();
        const allProperties: PublicProperty[] = Array.isArray(firstPage.properties)
          ? firstPage.properties
          : [];
        const total = typeof firstPage.total === "number" ? firstPage.total : allProperties.length;

        for (let page = 2; allProperties.length < total; page += 1) {
          const response = await fetch(`/api/properties?limit=250&page=${page}`);
          if (!response.ok) throw new Error(`Properties request failed (${response.status})`);
          const pageData = await response.json();
          if (!Array.isArray(pageData.properties) || pageData.properties.length === 0) break;
          allProperties.push(...pageData.properties);
        }
        if (isMounted) setProperties(allProperties);
      } catch (err) {
        console.error("Properties fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadProperties();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/cms/homepage", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("تعذر تحميل محتوى الصفحة الرئيسية");
        const data = await response.json();
        if (data.settings) setHomepageSettings(data.settings as CmsHomepageSettings);
      })
      .catch((error: unknown) => console.error("[Home] CMS content load failed:", error));
  }, []);

  useEffect(() => {
    fetch("/api/taxonomy")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Taxonomy request failed (${response.status})`);
        const data = await response.json();
        if (Array.isArray(data.districts)) setDistricts(data.districts);
      })
      .catch((error: unknown) => console.error("[Home] District search data load failed:", error));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchViewer = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!response.ok) throw new Error(`Auth request failed with status ${response.status}`);
        const data = await response.json();
        if (isMounted) {
          setViewerId(data.user?.id || null);
          setViewerLoaded(true);
        }
      } catch (error) {
        console.warn("[Home] Could not load current user for owner-only actions:", error);
        if (isMounted) setViewerId(null);
      }
    };
    void fetchViewer();
    window.addEventListener("auth-state-changed", fetchViewer);
    return () => {
      isMounted = false;
      window.removeEventListener("auth-state-changed", fetchViewer);
    };
  }, []);

  const homeIdentity = homepageSettings?.visualIdentity;
  const HomeBrandIcon = (() => {
    switch (homeIdentity?.logoIcon) {
      case "building": return Building2;
      case "sparkles": return Sparkles;
      case "compass": return Compass;
      case "shield": return Shield;
      case "crown": return Crown;
      case "layers": return Layers;
      case "home": return HomeIcon;
      default: return MapPin;
    }
  })();

  // Browser Geolocation trigger
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("متصفحك لا يدعم تحديد الموقع الجغرافي");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter([coords.lat, coords.lng]);
        setMapZoom(14);
        setAutoFitKey((key) => key + 1);
        setSortOrder("nearest");
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation denied or error:", err);
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Filtered and Sorted properties
  const filteredProperties = useMemo(() => {
    let list = [...properties];

    // Transaction Type
    list = list.filter((p) => p.transactionType === transactionType);

    // Category
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Search query
    if (searchQuery.trim()) {
      list = list.filter(
        (p) =>
          matchesSearchQuery(searchQuery, [
            p.title,
            p.description,
            p.addressDetails,
            p.id,
            p.slug,
            districtById.get(p.districtId)?.nameAr,
            districtById.get(p.districtId)?.nameEn,
            p.cityId === "city-dakahlia" ? "مركز ميت غمر Meet Ghamr" : "",
          ])
      );
    }

    // Keep results within the supported price range, even when no custom range is selected.
    list = list.filter((p) => p.price >= selectedMinPrice && p.price <= selectedMaxPrice);

    // Compute distance if user location is known
    if (userLocation) {
      list = list.map((p) => ({
        ...p,
        distanceMeters: calculateDistanceMeters(userLocation.lat, userLocation.lng, p.lat, p.lng),
      }));
    }

    // Sorting
    if (sortOrder === "price_asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortOrder === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortOrder === "nearest" && userLocation) {
      list.sort((a: any, b: any) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    } else {
      // Newest by default
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [properties, districtById, transactionType, selectedCategory, searchQuery, sortOrder, userLocation, selectedMinPrice, selectedMaxPrice]);

  const locationSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return districts.slice(0, 6);
    return districts
      .filter((district) => matchesSearchQuery(searchQuery, [district.nameAr, district.nameEn]))
      .slice(0, 6);
  }, [districts, searchQuery]);

  const addressSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const seenAddresses = new Set<string>();
    return properties
      .filter((property) => matchesSearchQuery(searchQuery, [property.addressDetails]))
      .map((property) => property.addressDetails?.trim() || "")
      .filter((address) => {
        if (!address || seenAddresses.has(address)) return false;
        seenAddresses.add(address);
        return true;
      })
      .slice(0, 4);
  }, [properties, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    const hasLocalLocation =
      districts.some((district) =>
        matchesSearchQuery(query, [district.nameAr, district.nameEn])
      ) || addressSuggestions.length > 0;
    if (query.length < 3 || hasLocalLocation) {
      setGeocodeSuggestions([]);
      setGeocodeQuery("");
      setGeocodeError("");
      setGeocoding(false);
      return;
    }

    setGeocoding(false);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setGeocoding(true);
      setGeocodeError("");
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر البحث عن الموقع");
        if (!controller.signal.aborted) {
          setGeocodeSuggestions(result.locations || []);
          setGeocodeQuery(query);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setGeocodeSuggestions([]);
          setGeocodeQuery(query);
          setGeocodeError(
            error instanceof Error ? error.message : "تعذر البحث عن الموقع"
          );
        }
      } finally {
        if (!controller.signal.aborted) setGeocoding(false);
      }
    }, 800);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery, districts, addressSuggestions]);

  const focusMapOnSearch = (query = searchQuery) => {
    const matchingDistrict = districts.find((district) =>
      matchesSearchQuery(query, [district.nameAr, district.nameEn])
    );
    if (matchingDistrict) {
      setSearchLocation({
        lat: matchingDistrict.centerLat,
        lng: matchingDistrict.centerLng,
        label: matchingDistrict.nameAr,
      });
      setMapCenter([matchingDistrict.centerLat, matchingDistrict.centerLng]);
      setMapZoom(14);
    } else if (geocodeQuery === query.trim() && geocodeSuggestions.length > 0) {
      selectGeocodedLocation(geocodeSuggestions[0]);
    }
    setAutoFitKey((key) => key + 1);
    setShowLocationSuggestions(false);
  };

  const selectGeocodedLocation = (location: {
    lat: number;
    lng: number;
    label: string;
  }) => {
    setSearchLocation(location);
    setMapCenter([location.lat, location.lng]);
    setMapZoom(16);
    setAutoFitKey((key) => key + 1);
    setShowLocationSuggestions(false);
  };

  const selectSearchDistrict = (district: District) => {
    setSearchQuery(district.nameAr);
    setSearchLocation({
      lat: district.centerLat,
      lng: district.centerLng,
      label: district.nameAr,
    });
    setMapCenter([district.centerLat, district.centerLng]);
    setMapZoom(14);
    setAutoFitKey((key) => key + 1);
    setShowLocationSuggestions(false);
  };

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();
    const matchingDistrict = districts.find((district) =>
      matchesSearchQuery(query, [district.nameAr, district.nameEn])
    );
    if (matchingDistrict || addressSuggestions.length > 0) {
      focusMapOnSearch(query);
      return;
    }
    if (geocodeQuery === query && geocodeSuggestions.length > 0) {
      selectGeocodedLocation(geocodeSuggestions[0]);
      return;
    }
    if (geocodeQuery === query) {
      focusMapOnSearch(query);
      return;
    }

    focusMapOnSearch(query);
    if (query.length < 3) return;
    try {
      setGeocoding(true);
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر البحث عن الموقع");
      setGeocodeSuggestions(result.locations || []);
      setGeocodeQuery(query);
      if (result.locations?.[0]) selectGeocodedLocation(result.locations[0]);
    } catch (error) {
      setGeocodeError(
        error instanceof Error ? error.message : "تعذر البحث عن الموقع"
      );
    } finally {
      setGeocoding(false);
    }
  };

  const toggleSelectedPropertyFavorite = async () => {
    if (!selectedProperty || favoriteActionLoading) return;

    const nextState = !selectedPropertyFavorited;
    setFavoriteActionLoading(true);
    setPreviewActionMessage("");
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          isFavorited: nextState,
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok || result.isFavorited !== nextState) {
        throw new Error(result.error || "تعذر تحديث المفضلة");
      }

      setSelectedPropertyFavorited(nextState);
      window.dispatchEvent(
        new CustomEvent("favorites-updated", {
          detail: { propertyId: selectedProperty.id, isFavorited: nextState },
        })
      );
      setPreviewActionMessage(nextState ? "أُضيف العقار إلى المفضلة" : "أُزيل العقار من المفضلة");
    } catch (error) {
      setPreviewActionMessage(error instanceof Error ? error.message : "تعذر تحديث المفضلة");
    } finally {
      setFavoriteActionLoading(false);
    }
  };

  const shareSelectedProperty = async () => {
    if (!selectedProperty) return;
    const url = `${window.location.origin}/properties/${encodeURIComponent(selectedProperty.slug)}`;
    setPreviewActionMessage("");
    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedProperty.title,
          text: selectedProperty.addressDetails || selectedProperty.title,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setPreviewActionMessage("تم نسخ رابط العقار");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setPreviewActionMessage("تعذرت مشاركة الرابط أو نسخه");
    }
  };

  // Active filter count for badge indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (
      (minPrice && !isNaN(Number(minPrice))) ||
      (maxPrice && !isNaN(Number(maxPrice)))
    ) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedCategory, minPrice, maxPrice, searchQuery]);

  return (
    <div className="relative w-full h-[100dvh] bg-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* ========================================================
          TOP HEADER: MAP VIEW (Image 1) OR LIST VIEW (Image 2)
          ======================================================== */}
      {viewMode === "map" ? (
        /* Large Comprehensive Top Board (لوحة تحكم وبحث علوية كبيرة وموحدة) */
        <div className="fixed top-2.5 inset-x-2 sm:inset-x-4 max-w-2xl mx-auto z-30 pointer-events-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-900/10 border border-slate-200 p-2.5 sm:p-3.5 space-y-2.5 transition-all">
            <div className="flex min-h-10 sm:min-h-12 items-center justify-center px-1">
              {homeIdentity?.logoType === "image" || !homeIdentity ? (
                <NextImage
                  src={homeIdentity?.logoImageUrl || DEFAULT_BRAND_LOGO_PATH}
                  alt={homeIdentity?.siteName || "دار العقار"}
                  width={200}
                  height={103}
                  unoptimized
                  style={{ height: `${getBrandLogoHeightPx(homeIdentity)}px`, width: "auto" }}
                  className="max-w-[76vw] object-contain"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: homeIdentity?.primaryColor || undefined }}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${
                      homeIdentity?.primaryColor ? "" : "bg-emerald-700"
                    }`}
                  >
                    <HomeBrandIcon className="h-5 w-5" />
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {homeIdentity?.siteName || "دار العقار"}
                  </span>
                </div>
              )}
            </div>
            {/* Row 1: Search Input */}
            <div className="flex items-center gap-2">
              {/* Notification Bell Button (Right side in RTL) */}
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(true)}
                aria-label="الإشعارات والتنبيهات الرسمية"
                title="الإشعارات والتنبيهات"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 active:scale-95 shadow-2xs"
              >
                <Bell className="h-5 w-5" />
                {unreadNoticesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                    {unreadNoticesCount > 9 ? "+9" : unreadNoticesCount}
                  </span>
                )}
              </button>

              {/* Direct Interactive Search Box */}
              <div className="flex-1 min-w-0 relative flex items-center bg-slate-50 hover:bg-slate-100/80 focus-within:bg-white rounded-xl border border-slate-200/90 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 transition-all px-2.5 py-1.5 sm:py-2">
                <button
                  type="button"
                  onClick={() => void handleSearchSubmit()}
                  aria-label="تنفيذ البحث على الخريطة"
                  className="ml-1.5 shrink-0 text-slate-400 hover:text-emerald-700"
                >
                  <Search className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => window.setTimeout(() => setShowLocationSuggestions(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearchSubmit();
                    }
                    if (event.key === "Escape") setShowLocationSuggestions(false);
                  }}
                  onChange={(e) => {
                    setSearchLocation(null);
                    setGeocodeSuggestions([]);
                    setGeocodeQuery("");
                    setGeocodeError("");
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="ابحث باسم القرية أو الشارع أو العقار..."
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchLocation(null);
                    }}
                    className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center shrink-0 mr-1"
                    aria-label="مسح البحث"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
                {showLocationSuggestions && (
                  <div className="absolute top-full right-0 left-0 mt-2 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    {locationSuggestions.length > 0 && (
                      <>
                        <p className="px-2 py-1 text-[10px] font-bold text-slate-400">
                          قرى ومناطق — اختر للانتقال على الخريطة
                        </p>
                        {locationSuggestions.map((district) => (
                          <button
                            key={district.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectSearchDistrict(district)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span>{district.nameAr}</span>
                            <span className="mr-auto text-[10px] font-medium text-slate-400">{district.nameEn}</span>
                          </button>
                        ))}
                      </>
                    )}
                    {addressSuggestions.length > 0 && (
                      <>
                        <p className="px-2 py-1 text-[10px] font-bold text-slate-400">شوارع وعناوين العقارات</p>
                        {addressSuggestions.map((address) => (
                          <button
                            key={address}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSearchQuery(address);
                              focusMapOnSearch(address);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{address}</span>
                          </button>
                        ))}
                      </>
                    )}
                    {geocodeQuery === searchQuery.trim() && geocodeSuggestions.length > 0 && (
                      <>
                        <p className="px-2 py-1 text-[10px] font-bold text-slate-400">
                          شوارع وأماكن على الخريطة
                        </p>
                        {geocodeSuggestions.map((location) => (
                          <button
                            key={`${location.lat},${location.lng}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectGeocodedLocation(location)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                            <span className="line-clamp-2">{location.label}</span>
                          </button>
                        ))}
                      </>
                    )}
                    {geocoding && (
                      <p className="px-2.5 py-2 text-xs text-slate-500">جارٍ البحث عن الشوارع والأماكن...</p>
                    )}
                    {geocodeError && (
                      <p role="status" className="px-2.5 py-2 text-xs text-rose-600">{geocodeError}</p>
                    )}
                    {searchQuery.trim().length >= 3 &&
                      geocodeQuery === searchQuery.trim() &&
                      !geocoding &&
                      !geocodeError &&
                      geocodeSuggestions.length === 0 &&
                      locationSuggestions.length === 0 &&
                      addressSuggestions.length === 0 && (
                        <p className="px-2.5 py-2 text-xs text-slate-500">
                          لم يتم العثور على مكان مطابق داخل نطاق البحث.
                        </p>
                      )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href="/ratings"
                  aria-label="تقييمات المناطق والعقارات"
                  title="التقييمات"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 active:scale-95"
                >
                  <Star className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Row 2: Transaction Type + Comprehensive Category Chips */}
            <div dir="rtl" className="flex items-center gap-2 pt-0.5 px-0.5">
              <div className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/70 shrink-0">
                <button
                  onClick={() => setTransactionType("sale")}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs transition-all ${
                    transactionType === "sale"
                      ? "bg-emerald-700 text-white font-extrabold shadow-xs"
                      : "text-slate-600 font-semibold hover:text-slate-900"
                  }`}
                >
                  للبيع
                </button>
                <button
                  onClick={() => setTransactionType("rent")}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs transition-all ${
                    transactionType === "rent"
                      ? "bg-emerald-700 text-white font-extrabold shadow-xs"
                      : "text-slate-600 font-semibold hover:text-slate-900"
                  }`}
                >
                  للإيجار
                </button>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar">
                {sortedCategoryChips.map((chip) => {
                  const isActive = selectedCategory === chip.id;
                  const categoryCount = chip.id === "all" ? properties.length : categoryCounts.get(chip.id) ?? 0;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => setSelectedCategory(chip.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                        isActive
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-sm shadow-emerald-700/20"
                          : "bg-slate-50 hover:bg-slate-100/90 text-slate-700 border-slate-200/80 active:bg-slate-200"
                      }`}
                    >
                      {chip.label} <span className="opacity-75">({categoryCount})</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowFilterModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-sm transition-all active:scale-95 shrink-0"
                aria-label="تصفية البحث"
              >
                <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
                <span className="font-extrabold text-xs">تصفية</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 font-black text-[10px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Row 3: Micro Status Info Bar (عدد العقارات والتصفية السريعة) */}
            <div className="flex items-center justify-between pt-1 px-1 border-t border-slate-100 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>
                  <strong>{filteredProperties.length}</strong> عقار متاح على الخريطة
                </span>
              </span>
              {(searchQuery || selectedCategory !== "all" || minPrice || maxPrice) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchLocation(null);
                    setSelectedCategory("all");
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                  className="text-emerald-700 hover:text-emerald-800 font-bold transition-colors hover:underline"
                >
                  إلغاء جميع الفلاتر
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List Mode Top Header (Image 2) */
        <div className="bg-white border-b border-slate-200 z-30 pt-3 pb-2 px-4 shadow-xs">
          {/* Header Row: Search Icon + Title + Back to Map */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilterModal(true)}
              className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/25 active:scale-95 transition-transform"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[2.5]" />
            </button>

            <h1 className="text-base font-black text-slate-900 tracking-tight">
              قائمة العقارات
            </h1>

            <button
              onClick={() => setViewMode("map")}
              className="p-1 text-slate-700 hover:text-emerald-700 transition-colors"
              title="العودة للخريطة"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-header Sorting Tabs: [الأحدث] | [السعر] | [الأقرب] */}
          <div className="grid grid-cols-4 bg-slate-100 rounded-xl p-1 text-center text-xs font-bold">
            <button
              onClick={() => setSortOrder("newest")}
              className={`py-1.5 rounded-lg transition-all ${
                sortOrder === "newest"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الأحدث
            </button>
            <button
              onClick={() => setSortOrder("price_asc")}
              className={`py-1.5 rounded-lg transition-all ${
                sortOrder === "price_asc"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الأقل سعراً
            </button>
            <button
              onClick={() => setSortOrder("price_desc")}
              className={`py-1.5 rounded-lg transition-all ${
                sortOrder === "price_desc"
                  ? "bg-white text-slate-900 font-black shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الأعلى سعراً
            </button>
            <button
              onClick={() => {
                if (!userLocation) {
                  handleDetectLocation();
                } else {
                  setSortOrder("nearest");
                }
              }}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                sortOrder === "nearest"
                  ? "bg-white text-emerald-700 font-black shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {locating && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
              <span>الأقرب</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          BODY CONTAINER: MAP VIEW OR LIST VIEW
          ======================================================== */}
      {viewMode === "map" ? (
        /* 1. Map View (Full Screen Edge-to-Edge) */
        <div className="absolute inset-0 w-full h-full z-0">
          <PropertyMap
            properties={filteredProperties}
            center={mapCenter}
            zoom={mapZoom}
            autoFitKey={autoFitKey}
            searchLocation={searchLocation}
            viewerId={viewerId}
            viewerLoaded={viewerLoaded}
            userLocation={userLocation}
            mapType={mapType}
            selectedPropertyId={selectedProperty?.id}
            onSelectProperty={(prop) => setSelectedProperty(prop)}
            onDirectContact={(prop) => setContactProperty(prop)}
            showMarkerPopups={false}
          />

          {/* Floating Controls on Map: Uniform circular white buttons in vertical column */}
          <div
            className={`fixed ${
              selectedProperty
                ? "bottom-[calc(5.5rem+11.5rem+0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7rem+12.5rem+0.75rem+env(safe-area-inset-bottom,0px))]"
                : "bottom-24 sm:bottom-28"
            } right-3.5 sm:right-4 z-30 flex flex-col gap-2.5 pointer-events-auto transition-[bottom] duration-200`}
          >
          {/* Properties List Button (top of the stack) */}
          <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="عرض قائمة العقارات"
              title="قائمة العقارات"
              className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 active:scale-95 transition-transform hover:bg-slate-50 text-emerald-700"
          >
              <ListIcon className="w-5 h-5 text-emerald-700" />
          </button>

          {/* GPS Location Button (middle) */}
          <button
              onClick={handleDetectLocation}
              disabled={locating}
              title="تحديد موقعي الجغرافي"
              className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 active:scale-95 transition-transform hover:bg-slate-50 text-emerald-700"
          >
              {locating ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" /> : <MapPin className="w-5 h-5 text-emerald-700" />}
          </button>

          {/* Satellite / Street Switcher (bottom of the stack) */}
          <button
              onClick={() => setMapType(mapType === "satellite" ? "street" : "satellite")}
              title="التبديل بين القمر الصناعي والخريطة"
              className="w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 active:scale-95 transition-transform hover:bg-slate-50 text-emerald-700"
          >
              <Layers className="w-5 h-5 text-emerald-700" />
          </button>
          </div>
        </div>
      ) : (
        /* 2. List View (Image 2) */
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-3 pb-36">
          {filteredProperties.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center mx-auto text-slate-500">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-600">لا توجد عقارات مطابقة للخيارات المحددة</p>
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setMinPrice("");
                  setMaxPrice("");
                  setSearchQuery("");
                  setSearchLocation(null);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            filteredProperties.map((prop: any) => (
              <Link
                key={prop.id}
                href={`/properties/${prop.slug}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all overflow-hidden group"
              >
                <div className="flex items-stretch gap-3 p-2.5">
                  {/* Thumbnail Image on the side */}
                  <div className="relative w-28 sm:w-36 h-28 shrink-0 rounded-xl overflow-hidden bg-slate-200">
                    <img
                      src={prop.images?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900/80 text-white backdrop-blur-xs">
                      {prop.transactionType === "sale" ? "للبيع" : "للإيجار"}
                    </div>
                  </div>

                  {/* Card Content Details */}
                  <div className="flex-1 flex flex-col justify-between text-right py-0.5">
                    <div>
                      {/* Title */}
                      <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                        {prop.title}
                      </h3>

                      {/* Price in Bold Green (Image 2 style) */}
                      <div className="text-base font-black text-emerald-700 mt-1">
                        {prop.price.toLocaleString("ar-EG")} ج.م {prop.rentalPeriod ? "/ شهر" : ""}
                      </div>

                      {/* Specs Row with Icons: Area, Zoning, Street/Rooms */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold mt-2">
                        <span className="flex items-center gap-1">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{prop.areaSqM} م²</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span>{CATEGORY_LABELS_AR[prop.category] || prop.category}</span>
                        </span>
                        {prop.bedrooms ? (
                          <span className="flex items-center gap-1">
                            <span>{prop.bedrooms} غرف</span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Address & Distance */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100 mt-1">
                      <span className="truncate max-w-[180px]">
                        {prop.addressDetails || "مركز ميت غمر ، محافظة الدقهلية"}
                      </span>
                      {prop.distanceMeters !== undefined && (
                        <span className="text-emerald-700 font-bold shrink-0">
                          {formatDistance(prop.distanceMeters)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* ========================================================
          QUICK PROPERTY PREVIEW CARD (Floats above the mobile navigation on pin click)
          ======================================================== */}
      {viewMode === "map" && selectedProperty && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-4 max-w-lg mx-auto z-40 pointer-events-auto animate-in slide-in-from-bottom-3 duration-200">
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-2.5 overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setSelectedProperty(null)}
              className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors z-10"
              title="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute left-12 top-2 z-10 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void toggleSelectedPropertyFavorite()}
                disabled={favoriteActionLoading}
                aria-label={
                  selectedPropertyFavorited ? "إزالة العقار من المفضلة" : "إضافة العقار إلى المفضلة"
                }
                aria-pressed={selectedPropertyFavorited}
                title={selectedPropertyFavorited ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors disabled:opacity-60 ${
                  selectedPropertyFavorited ? "text-rose-600" : "text-slate-600 hover:text-rose-600"
                }`}
              >
                <Heart className={`h-4 w-4 ${selectedPropertyFavorited ? "fill-rose-600" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => void shareSelectedProperty()}
                aria-label="مشاركة العقار"
                title="مشاركة العقار"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:text-emerald-700"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-stretch gap-2.5">
              <div className="relative min-h-36 w-1/3 shrink-0 self-stretch rounded-xl overflow-hidden bg-slate-200">
                <img
                  src={selectedProperty.images?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"}
                  alt={selectedProperty.title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-900/80 text-white">
                  {selectedProperty.transactionType === "sale" ? "للبيع" : "للإيجار"}
                </div>
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 pt-9 text-right">
                <h4 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-tight">
                  {selectedProperty.title}
                </h4>
                <div className="text-base sm:text-lg font-black text-emerald-700 leading-tight">
                  {selectedProperty.price.toLocaleString("ar-EG")} ج.م {selectedProperty.rentalPeriod ? "/ شهر" : ""}
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
                  <span>{selectedProperty.areaSqM} م²</span>
                  {selectedProperty.bedrooms ? (
                    <>
                      <span>•</span>
                      <span>{selectedProperty.bedrooms} غرف</span>
                    </>
                  ) : null}
                  {selectedProperty.bathrooms ? (
                    <>
                      <span>•</span>
                      <span>{selectedProperty.bathrooms} حمام</span>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <Link
                    href={`/properties/${selectedProperty.slug}`}
                    className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-emerald-800"
                  >
                    <span>عرض التفاصيل</span>
                  </Link>
                  {viewerLoaded && !isPropertyOwnedByUser(selectedProperty, viewerId) && (
                    <button
                      type="button"
                      onClick={() => setContactProperty(selectedProperty)}
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-slate-800 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>التواصل المباشر</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {previewActionMessage && (
              <p
                role="status"
                aria-live="polite"
                className="mt-1.5 text-center text-[11px] font-bold text-slate-600"
              >
                {previewActionMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          FILTER MODAL (Opens via [🔍 تصفية])
          ======================================================== */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">تصفية العقارات</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">نوع العملية</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTransactionType("sale")}
                  className={`py-2 rounded-lg transition-all ${
                    transactionType === "sale" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-500"
                  }`}
                >
                  للبيع
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("rent")}
                  className={`py-2 rounded-lg transition-all ${
                    transactionType === "rent" ? "bg-white text-emerald-700 shadow-xs font-black" : "text-slate-500"
                  }`}
                >
                  للإيجار
                </button>
              </div>
            </div>

            {/* Price Range */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">نطاق السعر (ج.م)</label>
                <span className="text-[10px] font-medium text-slate-400">
                  {hasPriceBounds
                    ? `${formatPrice(actualPriceBounds.min)} – ${formatPrice(actualPriceBounds.max)}`
                    : "لا توجد بيانات سعرية"}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div dir="ltr" className="relative h-6">
                  <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-600"
                    style={{ left: `${minThumbPosition}%`, width: `${Math.max(0, maxThumbPosition - minThumbPosition)}%` }}
                  />
                  <input
                    type="range"
                    aria-label="أقل سعر"
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    value={minThumbValue}
                    disabled={!hasPriceBounds}
                    onChange={(event) => {
                      const value = Math.min(Number(event.target.value), selectedMaxPrice);
                      setMinPrice(value <= actualPriceBounds.min ? "" : String(value));
                    }}
                    className={`price-range-thumb absolute inset-0 h-6 w-full ${
                      maxThumbValue - minThumbValue < sliderStep * 2 ? "z-[4]" : "z-[2]"
                    }`}
                  />
                  <input
                    type="range"
                    aria-label="أعلى سعر"
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    value={maxThumbValue}
                    disabled={!hasPriceBounds}
                    onChange={(event) => {
                      const value = Math.max(Number(event.target.value), selectedMinPrice);
                      setMaxPrice(value >= actualPriceBounds.max ? "" : String(value));
                    }}
                    className="price-range-thumb absolute inset-0 z-[3] h-6 w-full"
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-600">
                  <span>{hasPriceBounds ? formatPrice(selectedMinPrice) : "—"}</span>
                  <span>{hasPriceBounds ? formatPrice(selectedMaxPrice) : "—"}</span>
                </div>
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">نوع العقار</label>
              <div className="flex flex-wrap gap-1.5">
                {sortedCategoryChips.map((chip) => {
                  const categoryCount = chip.id === "all" ? properties.length : categoryCounts.get(chip.id) ?? 0;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSelectedCategory(chip.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCategory === chip.id
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {chip.label} ({categoryCount})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20"
              >
                عرض النتائج ({filteredProperties.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setMinPrice("");
                  setMaxPrice("");
                  setSearchQuery("");
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إعادة ضبط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DIRECT CONTACT MODAL (Opens from Map Popup or Preview Card)
          ======================================================== */}
      {contactProperty && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setContactProperty(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* Modal Header with Property Summary */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                  <img
                    src={contactProperty.images?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80"}
                    alt={contactProperty.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 text-right">
                  <h3 className="text-xs font-black text-slate-900 truncate">
                    {contactProperty.title}
                  </h3>
                  <div className="text-xs font-extrabold text-emerald-700">
                    {contactProperty.price.toLocaleString("ar-EG")} ج.م
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactProperty(null)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-App Direct Inquiry & Chat Form */}
            <InquiryForm
              propertyId={contactProperty.id}
              propertyTitle={contactProperty.title}
              advertiserId={contactProperty.advertiserId || contactProperty.advertiser?.id}
              autoOpenExistingChat={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
