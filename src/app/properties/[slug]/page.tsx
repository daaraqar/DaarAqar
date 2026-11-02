import React from "react";
import { notFound } from "next/navigation";
import { dbStore } from "@/lib/db/store";
import { propertyService } from "@/lib/services/propertyService";
import { getCurrentUser } from "@/lib/auth/session";
import PropertyMap from "@/components/map/PropertyMap";
import PropertyCard from "@/components/property/PropertyCard";
import InquiryForm from "./InquiryForm";
import ReportPropertyButton from "@/components/property/ReportPropertyButton";
import SmartPropertySuite from "@/components/property/SmartPropertySuite";
import MobilePropertyActionBar from "@/components/property/MobilePropertyActionBar";
import PropertyImageGallery from "@/components/property/PropertyImageGallery";
import PropertyHeaderActions from "@/components/property/PropertyHeaderActions";
import { isPropertyOwnedByUser } from "@/lib/utils/propertyOwnership";
import { APPROXIMATE_LOCATION_RADIUS_METERS, CATEGORY_LABELS_AR } from "@/lib/db/types";
import Link from "next/link";
import {
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Calendar,
  Layers,
  Phone,
  MessageCircle,
  Handshake,
  Eye,
  Car,
  Compass,
  Lock,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PropertyDetailsProps {
  params: {
    slug: string;
  };
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsProps) {
  const viewer = await getCurrentUser();
  const property = await propertyService.getPublicPropertyBySlugOrId(params.slug, viewer);

  if (!property) {
    notFound();
  }

  // Query similar properties in same district or category
  const { properties: similarProps } = await propertyService.queryPublicProperties({
    districtId: property.districtId,
    transactionType: property.transactionType,
    limit: 3,
  });

  const filteredSimilar = similarProps.filter((p) => p.id !== property.id);

  const isSale = property.transactionType === "sale";

  const isOwner = isPropertyOwnedByUser(property, viewer?.id);

  const isAdmin = Boolean(
    viewer &&
    (viewer.role === "admin" || (viewer.role as string) === "superadmin")
  );

  let isFavorited = false;
  if (viewer) {
    try {
      const favs = dbStore.getUserFavorites(viewer.id);
      isFavorited = favs.some((f) => f.id === property.id || f.slug === property.slug);
    } catch {}
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8 relative">
      {/* Prominent Restricted Listing Banner for Owner/Client */}
      {property.status === "pending_review" && (
        <div className="p-4 bg-amber-500/15 border-2 border-amber-400 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 font-bold text-xs sm:text-sm shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-700 shrink-0" />
            <span>منشور مقيد 🔒 — هذا العقار مقيد حالياً وبانتظار موافقة واعتماد إدارة المنصة (معاينة خاصة بك)</span>
          </div>
          <Link
            href="/dashboard/properties?status=pending_review"
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0 transition"
          >
            العودة للمنشورات المقيدة
          </Link>
        </div>
      )}

      {/* 1. Header & Title Strip */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                isSale ? "bg-brand-600" : "bg-blue-600"
              }`}
            >
              {isSale ? "للبيع" : "للإيجار"}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
              {CATEGORY_LABELS_AR[property.category] || property.category}
            </span>
            <PropertyHeaderActions
              propertyId={property.id}
              title={property.title}
              initialFavorited={isFavorited}
            />
            {property.isApproximateLocation ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                موقع تقريبي لحماية الخصوصية (نطاق {APPROXIMATE_LOCATION_RADIUS_METERS}م)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                موقع دقيق ومؤكد على الخريطة
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
            {property.title}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
            <span>{property.addressDetails}</span>
          </div>
          <div className="mt-3">
            <ReportPropertyButton propertyId={property.id} propertyTitle={property.title} />
          </div>
        </div>

        {/* Price Box */}
        <div dir="rtl" className="min-w-[200px] rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-right text-slate-500">السعر</span>
            <div dir="ltr" className="text-left text-2xl font-black text-brand-800 sm:text-3xl">
              {property.price.toLocaleString("ar-EG")} <span className="text-sm">ج.م</span>
              {property.rentalPeriod && <span className="text-xs text-slate-500"> / شهرياً</span>}
            </div>
          </div>
          {property.downPayment && (
            <div className="text-[11px] text-brand-700 font-semibold mt-1">
              مقدم: {property.downPayment.toLocaleString("ar-EG")} ج.م • تقسيط على {property.installmentYears} سنوات
            </div>
          )}
          {property.negotiable && (
            <div className="mt-2 w-full pt-2 border-t border-brand-200/60">
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-600 text-white flex items-center justify-center gap-1">
                <Handshake className="w-3 h-3" />
                <span>السعر قابل للتفاوض</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Photo Gallery Grid */}
      <PropertyImageGallery images={property.images} title={property.title} />

      {/* 3. Main Body & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Details & Map */}
        <div className="lg:col-span-2 space-y-8">
          {/* Specifications Strip */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">المواصفات الفنية للعقار</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block mb-1">المساحة الإجمالية</span>
                <span className="text-sm font-extrabold text-slate-800">{property.areaSqM} م²</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block mb-1">غرف النوم</span>
                <span className="text-sm font-extrabold text-slate-800">{property.bedrooms || "-"} غرف</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block mb-1">الحمامات</span>
                <span className="text-sm font-extrabold text-slate-800">{property.bathrooms || "-"} حمام</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block mb-1">الدور</span>
                <span className="text-sm font-extrabold text-slate-800">{property.floor ? `الدور ${property.floor}` : "أرضي"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-400 block mb-0.5">مستوى التشطيب</span>
                <span className="font-bold text-slate-800">{getFinishingLabel(property.finishingStatus)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">الفرش</span>
                <span className="font-bold text-slate-800">{getFurnishingLabel(property.furnishingStatus)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">أماكن السيارات</span>
                <span className="font-bold text-slate-800">{property.parkingSpots || 0} سيارة</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">وصف العقار والموقع</h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
              {property.description}
            </p>
          </div>

          {/* حزمة الذكاء العقاري المتكاملة - مخفية مؤقتاً */}
          {/* <SmartPropertySuite property={property} /> */}

          {/* Location & Map Section */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  الموقع الجغرافي على الخريطة
                </h3>
                <p className="text-xs text-slate-500">
                  {property.isApproximateLocation
                    ? "نطاق تقريبي دائري لحماية خصوصية المالك، لن تُفصح الإحداثيات الدقيقة للعامة."
                    : "موقع دقيق ومؤكد على الخريطة التفاعلية."}
                </p>
              </div>
            </div>

            <div className="w-full h-72 rounded-2xl overflow-hidden border border-slate-200">
              <PropertyMap
                properties={[property]}
                viewerId={viewer?.id ?? null}
                viewerLoaded
                selectedPropertyId={property.id}
                center={[property.lat, property.lng]}
                zoom={14}
              />
            </div>
          </div>
        </div>

        {/* Right Col: Advertiser Card & Inquiry Form */}
        <div className="space-y-6">
          {/* Advertiser Profile Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-800 font-extrabold flex items-center justify-center text-lg">
                {property.advertiser.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900 text-sm">{property.advertiser.name}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {property.advertiser.role === "broker" ? "وسيط عقاري" : "مالك العقار مباشرة"}
                </span>
                {property.advertiser.companyName && (
                  <span className="text-xs text-brand-700 font-semibold block">
                    {property.advertiser.companyName}
                  </span>
                )}
              </div>
            </div>

            {/* Direct Action Buttons */}
            {!isOwner && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {property.advertiser.phone && (
                  <a
                    href={`tel:${property.advertiser.phone}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>اتصال هاتفي</span>
                  </a>
                )}
                {property.advertiser.whatsapp && (
                  <a
                    href={`https://wa.me/${property.advertiser.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>محادثة واتساب</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Lead Inquiry Form or Owner Card */}
          <div id="direct-contact" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs scroll-mt-24">
            <InquiryForm
              propertyId={property.id}
              propertyTitle={property.title}
              advertiserId={property.advertiserId || property.advertiser?.id}
              isOwner={isOwner}
              isAdmin={isAdmin}
              initialUser={viewer ? { id: viewer.id, name: viewer.name, phone: viewer.phone, email: viewer.email, role: viewer.role } : null}
            />
          </div>
        </div>
      </div>

      {/* 4. Similar Properties */}
      {filteredSimilar.length > 0 && (
        <div className="pt-8 border-t border-slate-200 space-y-4">
          <h3 className="text-xl font-black text-slate-900">
            عقارات مشابهة في نفس المنطقة
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSimilar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </div>
      )}

      {/* Sticky Mobile Direct Action Bar (Call, WhatsApp, Share, Favorite, Owner Dashboard) */}
      <MobilePropertyActionBar
        phone={property.advertiser.phone}
        whatsapp={property.advertiser.whatsapp}
      />
    </div>
  );
}

function getFinishingLabel(status?: string): string {
  switch (status) {
    case "ultra_lux":
      return "ألترا سوبر لوكس";
    case "fully_finished":
      return "تشطيب كامل (سوبر لوكس)";
    case "semi_finished":
      return "نصف تشطيب (محارة وحلوق)";
    case "core_and_shell":
      return "طوب أحمر (Core & Shell)";
    default:
      return "غير محدد";
  }
}

function getFurnishingLabel(status?: string): string {
  switch (status) {
    case "furnished":
      return "مفروش بالكامل";
    case "semi_furnished":
      return "مفروش جزئياً";
    case "unfurnished":
      return "غير مفروش";
    default:
      return "غير محدد";
  }
}
