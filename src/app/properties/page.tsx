"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFiltersBar from "@/components/property/PropertyFiltersBar";
import { PublicProperty, PropertyFilterParams, District, PropertyCategory, TransactionType } from "@/lib/db/types";
import { Loader2, Compass, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { PropertyCardSkeleton } from "@/components/ui/LoadingSkeleton";

import { apiFetch } from "@/lib/apiClient";

function PropertiesCatalogContent() {
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchRequestIdRef = React.useRef(0);

  const [filters, setFilters] = useState<PropertyFilterParams>(() => {
    const q = searchParams.get("q") || undefined;
    const districtId = searchParams.get("districtId") || undefined;
    const category = searchParams.get("category");
    const transactionType = searchParams.get("transactionType");

    return {
      sort: "newest",
      page: 1,
      limit: 24,
      searchQuery: q,
      districtId,
      category: category && category !== "all" ? (category as PropertyCategory) : undefined,
      transactionType: transactionType && transactionType !== "all" ? (transactionType as TransactionType) : undefined,
    };
  });

  useEffect(() => {
    apiFetch("/api/taxonomy")
      .then((res) => res.json())
      .then((data) => {
        if (data.districts) setDistricts(data.districts);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") || undefined;
    const districtId = searchParams.get("districtId") || undefined;
    const category = searchParams.get("category");
    const transactionType = searchParams.get("transactionType");

    setFilters((prev) => ({
      ...prev,
      searchQuery: q,
      districtId,
      category: category && category !== "all" ? (category as PropertyCategory) : undefined,
      transactionType: transactionType && transactionType !== "all" ? (transactionType as TransactionType) : undefined,
    }));
  }, [searchParams]);

  useEffect(() => {
    fetchProperties(filters);
  }, [filters]);

  const fetchProperties = async (currentFilters: PropertyFilterParams) => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (currentFilters.transactionType) q.set("transactionType", currentFilters.transactionType);
      if (currentFilters.category) q.set("category", currentFilters.category);
      if (currentFilters.districtId) q.set("districtId", currentFilters.districtId);
      if (currentFilters.minPrice) q.set("minPrice", currentFilters.minPrice.toString());
      if (currentFilters.maxPrice) q.set("maxPrice", currentFilters.maxPrice.toString());
      if (currentFilters.minArea) q.set("minArea", currentFilters.minArea.toString());
      if (currentFilters.maxArea) q.set("maxArea", currentFilters.maxArea.toString());
      if (currentFilters.bedrooms) q.set("bedrooms", currentFilters.bedrooms.toString());
      if (currentFilters.searchQuery) q.set("q", currentFilters.searchQuery);
      if (currentFilters.sort) q.set("sort", currentFilters.sort);
      if (currentFilters.featuredOnly) q.set("featuredOnly", "true");
      if (currentFilters.page) q.set("page", currentFilters.page.toString());
      q.set("limit", "24");

      const res = await apiFetch(`/api/properties?${q.toString()}`);
      if (requestId !== fetchRequestIdRef.current) return;

      const data = await res.json();
      if (data && Array.isArray(data.properties)) {
        setProperties(data.properties);
        setTotal(typeof data.total === "number" ? data.total : data.properties.length);
      }
    } catch (err) {
      console.error("[Properties] Fetch error:", err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Build Explore URL forwarding current search filters
  const buildExploreUrl = () => {
    const params = new URLSearchParams();
    if (filters.searchQuery?.trim()) params.set("q", filters.searchQuery.trim());
    if (filters.districtId) params.set("districtId", filters.districtId);
    if (filters.category) params.set("category", filters.category);
    if (filters.transactionType) params.set("transactionType", filters.transactionType);
    if (filters.minPrice) params.set("minPrice", filters.minPrice.toString());
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice.toString());
    const queryStr = params.toString();
    return queryStr ? `/explore?${queryStr}` : "/explore";
  };

  const currentDistrict = districts.find((d) => d.id === filters.districtId);
  const pageTitle = currentDistrict
    ? `دليل العقارات المتاحة في ${currentDistrict.nameAr}`
    : "دليل عقارات مركز ميت غمر وقراه";

  const totalPages = Math.ceil(total / (filters.limit || 24));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            إجمالي {total} عقار مطابق للشروط الجغرافية
          </p>
        </div>

        <Link
          href={buildExploreUrl()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold text-xs transition-colors shadow-xs"
        >
          <Compass className="w-4 h-4 text-brand-600" />
          <span>عرض البحث على الخريطة التفاعلية</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <PropertyFiltersBar
        filters={filters}
        onFilterChange={(newF) => setFilters(newF)}
        onReset={() => setFilters({ sort: "newest", page: 1, limit: 24 })}
        districts={districts}
      />

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          title="لم يتم العثور على عقارات مطابقة"
          description="لم نجد عقارات تطابق معايير التصفية التي حددتها. يرجى تجربة تغيير نطاق السعر أو اختيار مناطق أخرى."
          actionLabel="إعادة تعيين كافة الفلاتر"
          onAction={() => setFilters({ sort: "newest", page: 1, limit: 24 })}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-8 border-t border-slate-200 mt-8">
              <Pagination
                currentPage={filters.page || 1}
                totalPages={totalPages}
                totalItems={total}
                pageSize={filters.limit || 24}
                onPageChange={(p) => {
                  setFilters((prev) => ({ ...prev, page: p }));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PropertiesCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-xs font-bold">جاري تحميل دليل العقارات...</span>
        </div>
      }
    >
      <PropertiesCatalogContent />
    </Suspense>
  );
}
