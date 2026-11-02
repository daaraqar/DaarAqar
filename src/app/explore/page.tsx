"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PropertyMap from "@/components/map/PropertyMap";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFiltersBar from "@/components/property/PropertyFiltersBar";
import { PublicProperty, PropertyFilterParams, District, PropertyCategory, TransactionType, CATEGORY_LABELS_AR } from "@/lib/db/types";
import { Compass, List, Map as MapIcon, Loader2, AlertCircle, X, Search, CheckCircle2 } from "lucide-react";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PublicProperty | null>(null);
  const [mobileView, setMobileView] = useState<"split" | "map" | "list">("split");
  const [autoFitKey, setAutoFitKey] = useState<number>(Date.now());
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.7194, 31.258]);
  const [mapZoom, setMapZoom] = useState<number>(11);

  // Initialize filters from URL query parameters
  const [filters, setFilters] = useState<PropertyFilterParams>(() => {
    const q = searchParams.get("q") || undefined;
    const districtId = searchParams.get("districtId") || undefined;
    const category = searchParams.get("category");
    const transactionType = searchParams.get("transactionType");
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;

    return {
      sort: "newest",
      limit: 50,
      searchQuery: q,
      districtId,
      category: category && category !== "all" ? (category as PropertyCategory) : undefined,
      transactionType: transactionType && transactionType !== "all" ? (transactionType as TransactionType) : undefined,
      maxPrice: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
      minPrice: minPrice && !isNaN(minPrice) ? minPrice : undefined,
    };
  });

  // Fetch taxonomy on mount
  useEffect(() => {
    fetch("/api/taxonomy")
      .then((res) => res.json())
      .then((data) => {
        if (data.districts) {
          setDistricts(data.districts);
        }
      })
      .catch((err) => console.error("Taxonomy fetch error:", err));
  }, []);

  // Sync state when URL search params change (e.g. from homepage search navigation)
  useEffect(() => {
    const q = searchParams.get("q") || undefined;
    const districtId = searchParams.get("districtId") || undefined;
    const category = searchParams.get("category");
    const transactionType = searchParams.get("transactionType");
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;

    setFilters((prev) => ({
      ...prev,
      searchQuery: q,
      districtId,
      category: category && category !== "all" ? (category as PropertyCategory) : undefined,
      transactionType: transactionType && transactionType !== "all" ? (transactionType as TransactionType) : undefined,
      maxPrice: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
      minPrice: minPrice && !isNaN(minPrice) ? minPrice : undefined,
      bounds: undefined, // Clear bounds to scan nationwide when search params change
    }));

    // Trigger map camera transition
    setAutoFitKey(Date.now());
  }, [searchParams]);

  // Fetch properties whenever filters change
  const fetchProperties = useCallback(async (currentFilters: PropertyFilterParams) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();

      if (currentFilters.transactionType) queryParams.set("transactionType", currentFilters.transactionType);
      if (currentFilters.category) queryParams.set("category", currentFilters.category);
      if (currentFilters.districtId) queryParams.set("districtId", currentFilters.districtId);
      if (currentFilters.minPrice) queryParams.set("minPrice", currentFilters.minPrice.toString());
      if (currentFilters.maxPrice) queryParams.set("maxPrice", currentFilters.maxPrice.toString());
      if (currentFilters.minArea) queryParams.set("minArea", currentFilters.minArea.toString());
      if (currentFilters.maxArea) queryParams.set("maxArea", currentFilters.maxArea.toString());
      if (currentFilters.bedrooms) queryParams.set("bedrooms", currentFilters.bedrooms.toString());
      if (currentFilters.searchQuery) queryParams.set("q", currentFilters.searchQuery);
      if (currentFilters.sort) queryParams.set("sort", currentFilters.sort);
      if (currentFilters.featuredOnly) queryParams.set("featuredOnly", "true");

      // Viewport Bounds if no global search query is overriding
      if (currentFilters.bounds && !currentFilters.searchQuery && !currentFilters.districtId) {
        const { southWest, northEast } = currentFilters.bounds;
        queryParams.set("bounds", `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`);
      }

      queryParams.set("limit", "50");

      const res = await fetch(`/api/properties?${queryParams.toString()}`);
      const data = await res.json();
      if (data.properties) {
        setProperties(data.properties);

        // If a specific property was searched or single result found, select it
        const targetPropId = searchParams.get("propertyId");
        if (targetPropId) {
          const match = data.properties.find((p: PublicProperty) => p.id === targetPropId);
          if (match) setSelectedProperty(match);
        } else if (data.properties.length === 1) {
          setSelectedProperty(data.properties[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Execute fetch when filters change
  useEffect(() => {
    fetchProperties(filters);
  }, [filters, fetchProperties]);

  // When districts load, adjust map center if district or query matches
  useEffect(() => {
    if (districts.length === 0) return;

    let matchedDistrict: District | undefined;

    if (filters.districtId) {
      matchedDistrict = districts.find((d) => d.id === filters.districtId);
    } else if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      matchedDistrict = districts.find(
        (d) =>
          d.nameAr.toLowerCase().includes(q) ||
          q.includes(d.nameAr.toLowerCase()) ||
          d.nameEn.toLowerCase().includes(q)
      );
    }

    if (matchedDistrict && matchedDistrict.centerLat && matchedDistrict.centerLng) {
      setMapCenter([matchedDistrict.centerLat, matchedDistrict.centerLng]);
      setMapZoom(13);
      setAutoFitKey(Date.now());
    }
  }, [districts, filters.districtId, filters.searchQuery]);

  // Handle user dragging / zooming the map
  const handleBoundsChange = (bounds: {
    southWest: { lat: number; lng: number };
    northEast: { lat: number; lng: number };
  }) => {
    // Only constrain by viewport bounds if user is exploring freely without a text query or district
    if (!filters.searchQuery && !filters.districtId) {
      setFilters((prev) => ({
        ...prev,
        bounds,
      }));
    }
  };

  // Handle filter changes from PropertyFiltersBar
  const handleFilterChange = (newFilters: PropertyFilterParams) => {
    // When user changes search query or district, clear bounds to search globally
    const updated = {
      ...newFilters,
      bounds: undefined,
    };
    setFilters(updated);
    setAutoFitKey(Date.now());

    // Sync URL without reloading
    const params = new URLSearchParams();
    if (updated.searchQuery?.trim()) params.set("q", updated.searchQuery.trim());
    if (updated.districtId) params.set("districtId", updated.districtId);
    if (updated.category) params.set("category", updated.category);
    if (updated.transactionType) params.set("transactionType", updated.transactionType);
    if (updated.minPrice) params.set("minPrice", updated.minPrice.toString());
    if (updated.maxPrice) params.set("maxPrice", updated.maxPrice.toString());

    const queryString = params.toString();
    const newUrl = queryString ? `/explore?${queryString}` : "/explore";
    window.history.replaceState(null, "", newUrl);
  };

  const handleResetFilters = () => {
    setFilters({ sort: "newest", limit: 50 });
    setAutoFitKey(Date.now());
    window.history.replaceState(null, "", "/explore");
  };

  // Find active district name if filtered
  const activeDistrictName = districts.find((d) => d.id === filters.districtId)?.nameAr;
  const isSearchActive = Boolean(filters.searchQuery || filters.districtId || filters.category || filters.maxPrice);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1700px] mx-auto px-2 sm:px-4 py-2 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="shrink-0 mb-2">
        <PropertyFiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          districts={districts}
        />
      </div>

      {/* Active Search & Map Feedback Bar */}
      {isSearchActive && (
        <div className="shrink-0 mb-2 px-3 py-2 bg-gradient-to-r from-brand-900 to-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-sm border border-brand-700/50">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse" />
            <Search className="w-3.5 h-3.5 text-brand-300" />
            <span>البحث النشط على الخريطة:</span>
            {filters.searchQuery && (
              <span className="bg-brand-500/30 px-2.5 py-0.5 rounded-lg border border-brand-400/30 text-brand-200">
                &ldquo;{filters.searchQuery}&rdquo;
              </span>
            )}
            {activeDistrictName && (
              <span className="bg-teal-500/30 px-2.5 py-0.5 rounded-lg border border-teal-400/30 text-teal-200">
                منطقة: {activeDistrictName}
              </span>
            )}
            {filters.category && (
              <span className="bg-slate-800 px-2.5 py-0.5 rounded-lg text-slate-300">
                نوع العقار: {CATEGORY_LABELS_AR[filters.category] || filters.category}
              </span>
            )}
            <span className="text-slate-300 mr-2">
              (تم تحديد <strong className="text-brand-300">{properties.length}</strong> عقار على الخريطة)
            </span>
          </div>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded-xl transition-all"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>مسح البحث والعودة لكامل الخريطة</span>
          </button>
        </div>
      )}

      {/* Mobile Toggle Buttons (Map vs List) */}
      <div className="md:hidden flex items-center justify-center gap-2 mb-2 bg-white p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setMobileView("map")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileView === "map" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600"
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>الخريطة التفاعلية ({properties.length})</span>
        </button>
        <button
          onClick={() => setMobileView("list")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileView === "list" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>قائمة الوحدات ({properties.length})</span>
        </button>
      </div>

      {/* Main Split-Screen Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden min-h-0">
        {/* Left Side (Desktop): Interactive Map */}
        <div
          className={`h-full flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative ${
            mobileView === "list" ? "hidden md:block" : "block"
          }`}
        >
          <PropertyMap
            properties={properties}
            selectedPropertyId={selectedProperty?.id}
            onSelectProperty={(p) => {
              setSelectedProperty(p);
              if (p) {
                const el = document.getElementById(`prop-card-${p.id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            onBoundsChange={handleBoundsChange}
            center={mapCenter}
            zoom={mapZoom}
            autoFitKey={autoFitKey}
          />

          {/* Map Floating Summary Badge */}
          <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/90 text-xs font-bold text-slate-800 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span>
              {properties.length > 0 ? (
                <>
                  <strong className="text-brand-700">{properties.length}</strong> عقار متاح في هذا النطاق
                </>
              ) : (
                "لا توجد عقارات في هذا النطاق"
              )}
            </span>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />}
          </div>
        </div>

        {/* Right Side (Desktop): Scrollable List */}
        <div
          className={`w-full md:w-[480px] lg:w-[540px] xl:w-[580px] h-full flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm shrink-0 ${
            mobileView === "map" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* List Header */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                نتائج البحث الجغرافي ({properties.length} عقار)
              </span>
              {selectedProperty && (
                <span className="text-[10px] bg-brand-100 text-brand-800 font-bold px-2 py-0.5 rounded-md">
                  محدد على الخريطة
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              انقر على أي عقار لتحديده بالخريطة
            </span>
          </div>

          {/* Cards Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading && properties.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
                <span className="font-bold text-slate-600">جاري تحديد مواقع العقارات وتحديث الخريطة...</span>
              </div>
            ) : properties.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs gap-3 p-6 text-center">
                <AlertCircle className="w-9 h-9 text-amber-500" />
                <span className="font-extrabold text-sm text-slate-800">
                  {filters.searchQuery
                    ? `لم يتم العثور على عقارات مطابقة لـ "${filters.searchQuery}"`
                    : "لا توجد عقارات مطابقة في هذا النطاق"}
                </span>
                <span className="max-w-xs text-slate-500 text-[11px]">
                  جرّب تخفيف شروط التصفية أو البحث في قرى مركز ميت غمر مثل دقادوس أو أتميدة.
                </span>
                <button
                  onClick={handleResetFilters}
                  className="mt-1 px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-all shadow-sm"
                >
                  إعادة ضبط الخريطة والبحث
                </button>
              </div>
            ) : (
              properties.map((property) => (
                <div
                  key={property.id}
                  id={`prop-card-${property.id}`}
                  className={`transition-all rounded-2xl ${
                    selectedProperty?.id === property.id
                      ? "ring-2 ring-brand-500 shadow-md bg-brand-50/20"
                      : ""
                  }`}
                >
                  <PropertyCard
                    property={property}
                    isSelected={selectedProperty?.id === property.id}
                    onHover={(p) => setSelectedProperty(p)}
                    onClick={(p) => setSelectedProperty(p)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-xs font-bold">جاري تحميل الخريطة التفاعلية...</span>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
