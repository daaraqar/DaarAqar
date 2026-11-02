"use client";

import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import {
  X,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Image as ImageIcon,
  User,
  Sliders,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
  Upload,
} from "lucide-react";
import { compressImageClientSide } from "@/lib/utils/imageCompression";
import { apiFetch } from "@/lib/apiClient";
import {
  APPROXIMATE_LOCATION_RADIUS_METERS,
  OFFICIAL_PROPERTY_CATEGORIES,
  type District,
} from "@/lib/db/types";

interface PropertySubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PropertySubmissionModal({
  isOpen,
  onClose,
  onSuccess,
}: PropertySubmissionModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);

  useEffect(() => {
    apiFetch("/api/taxonomy")
      .then(async (response) => {
        if (!response.ok) throw new Error("تعذر تحميل قرى ومناطق ميت غمر");
        const taxonomy = await response.json();
        setDistricts(Array.isArray(taxonomy.districts) ? taxonomy.districts : []);
      })
      .catch((error: unknown) => console.error("[PropertySubmissionModal] Taxonomy load failed:", error));
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    transactionType: "sale",
    category: "apartment",
    price: "",
    rentalPeriod: "monthly",
    negotiable: false,
    downPayment: "",
    installmentYears: "",

    areaSqM: "",
    bedrooms: "3",
    bathrooms: "2",
    floor: "2",
    totalFloors: "5",
    finishingStatus: "fully_finished",
    furnishingStatus: "unfurnished",
    parkingSpots: "1",
    hasElevator: true,
    amenities: ["security_24_7", "private_parking"],

    cityId: "city-dakahlia",
    districtId: "dist-meet-ghamr-city",
    addressDetails: "شارع البحر (الكورنيش)، ميت غمر",
    lat: 30.7180,
    lng: 31.2620,
    locationPrivacy: "exact", // 'exact' or 'approximate'

    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    ],
    newImageUrl: "",

    advertiserType: "owner",
    phone: "+201001234567",
    whatsappEnabled: true,
  });

  const [uploadingImages, setUploadingImages] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setCompressionNotice("جاري فحص الصور وضغطها تلقائياً على جهازك قبل الرفع...");

    try {
      const fileList = Array.from(files);
      const compressedList = await Promise.all(
        fileList.map((file) =>
          compressImageClientSide(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.82,
            mimeType: "image/webp",
          })
        )
      );

      setCompressionNotice("جاري الرفع السحابي لخدمة التخزين...");

      const uploadedUrls: string[] = [];
      for (const item of compressedList) {
        const body = new FormData();
        body.append("file", item.file);
        body.append("propertyId", "draft");

        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls],
        }));
        setCompressionNotice(`تم ضغط ورفع ${uploadedUrls.length} صور بنجاح`);
      } else {
        setCompressionNotice("تعذر رفع الصور المختارة");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ أثناء معالجة الصور";
      setCompressionNotice(msg);
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!isOpen) return null;

  const nextStep = async () => {
    // If advancing to review step, perform duplicate check
    if (step === 5) {
      checkDuplicates();
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const checkDuplicates = async () => {
    try {
      const res = await fetch("/api/properties/duplicate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          transactionType: formData.transactionType,
          price: Number(formData.price),
          areaSqM: Number(formData.areaSqM),
          bedrooms: Number(formData.bedrooms),
          lat: Number(formData.lat),
          lng: Number(formData.lng),
        }),
      });
      const data = await res.json();
      if (data.hasPotentialDuplicate) {
        setDuplicateWarning(
          `تنبيه تدقيق الجودة: رصد النظام نسبة تشابه ${data.confidenceScore}% مع عقار مسجل في نفس المربع السكني. سيتم توجيه الإعلان للمراجعة الإدارية للتحقق من سلامة البيانات.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Ignored
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 10_000);

    try {
      const res = await apiFetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({
          ...formData,
          status: "pending_review",
          price: Number(formData.price),
          areaSqM: Number(formData.areaSqM),
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          floor: Number(formData.floor),
          lat: Number(formData.lat),
          lng: Number(formData.lng),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("تم إرسال العقار بنجاح! تم وضعه في قائمة المراجعة أو نشره مباشرة حسب الصلاحية.");
        onClose();
        if (onSuccess) onSuccess();
      } else {
        alert(data.error || "حدث خطأ أثناء إضافة العقار");
      }
    } catch (err: unknown) {
      alert(
        requestController.signal.aborted
          ? "استغرق إرسال العقار أكثر من 10 ثوانٍ. تحقق من الاتصال ثم أعد المحاولة."
          : "حدث خطأ في الاتصال بالخادم"
      );
    } finally {
      window.clearTimeout(requestTimeout);
      setLoading(false);
    }
  };

  const handleAddImage = () => {
    if (formData.newImageUrl.trim()) {
      setFormData({
        ...formData,
        images: [...formData.images, formData.newImageUrl.trim()],
        newImageUrl: "",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Steps */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              إضافة عقار جديد (دار العقار)
            </h3>
            <p className="text-xs text-slate-500">
              خطوة {step} من 6: {getStepTitle(step)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-brand-600 h-1.5 transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-800">
          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان الإعلان *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شقة للبيع في ميت غمر أو إحدى قراها"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع المعاملة *</label>
                  <select
                    value={formData.transactionType}
                    onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="sale">للبيع</option>
                    <option value="rent">للإيجار</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع العقار *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {OFFICIAL_PROPERTY_CATEGORIES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    السعر المطلوب (ج.م) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100_000_000}
                    placeholder="مثال: 5500000"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: e.target.value
                          ? String(Math.min(100_000_000, Math.max(1, Number(e.target.value))))
                          : "",
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">قابل للتفاوض</label>
                  <div className="flex items-center gap-2 pt-2.5">
                    <input
                      type="checkbox"
                      checked={formData.negotiable}
                      onChange={(e) => setFormData({ ...formData, negotiable: e.target.checked })}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold text-slate-700">السعر قابل للتفاوض</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  تفاصيل ووصف العقار *
                </label>
                <textarea
                  rows={4}
                  placeholder="اكتب وصفاً دقيقاً للموقع، التشطيب، الإطلالة، والخدمات المتاحة..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Specifications */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المساحة (م²) *</label>
                  <input
                    type="number"
                    required
                    placeholder="180"
                    value={formData.areaSqM}
                    onChange={(e) => setFormData({ ...formData, areaSqM: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">غرف النوم</label>
                  <input
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحمامات</label>
                  <input
                    type="number"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة التشطيب</label>
                  <select
                    value={formData.finishingStatus}
                    onChange={(e) => setFormData({ ...formData, finishingStatus: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="ultra_lux">ألترا سوبر لوكس</option>
                    <option value="fully_finished">تشطيب كامل (سوبر لوكس)</option>
                    <option value="semi_finished">نصف تشطيب (محارة وحلوق)</option>
                    <option value="core_and_shell">طوب أحمر (Core & Shell)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة الفرش</label>
                  <select
                    value={formData.furnishingStatus}
                    onChange={(e) => setFormData({ ...formData, furnishingStatus: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="unfurnished">غير مفروش</option>
                    <option value="semi_furnished">مفروش جزئياً (مطبخ وأجهزة)</option>
                    <option value="furnished">مفروش بالكامل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الدور</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">أماكن انتظار السيارات</label>
                  <input
                    type="number"
                    value={formData.parkingSpots}
                    onChange={(e) => setFormData({ ...formData, parkingSpots: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Location & Geospatial Privacy Engine */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المدينة *</label>
                  <select
                    value={formData.cityId}
                    onChange={(e) => setFormData({ ...formData, cityId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="city-dakahlia">مركز ميت غمر</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">القرية / المنطقة *</label>
                  <select
                    value={formData.districtId}
                    onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>{district.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تفاصيل العنوان</label>
                <input
                  type="text"
                  placeholder="مثال: شارع البحر، بجوار مجمع المحاكم أو ميدان المحطة"
                  value={formData.addressDetails}
                  onChange={(e) => setFormData({ ...formData, addressDetails: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              {/* Coordinates Preview */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">خط العرض (Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: Number(e.target.value) })}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">خط الطول (Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: Number(e.target.value) })}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-mono"
                  />
                </div>
              </div>

              {/* CRITICAL FEATURE: Location Privacy Radio */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>إعدادات خصوصية موقع العقار على الخريطة:</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="locationPrivacy"
                      value="exact"
                      checked={formData.locationPrivacy === "exact"}
                      onChange={() => setFormData({ ...formData, locationPrivacy: "exact" })}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">عرض الموقع الدقيق</span>
                      <span className="text-[11px] text-slate-500">
                        سيظهر دبوس الموقع بالضبط على الخريطة العامة للباحثين.
                      </span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="locationPrivacy"
                      value="approximate"
                      checked={formData.locationPrivacy === "approximate"}
                      onChange={() => setFormData({ ...formData, locationPrivacy: "approximate" })}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold text-amber-900 block">
                        موقع تقريبي لحماية الخصوصية (نطاق {APPROXIMATE_LOCATION_RADIUS_METERS} متر)
                      </span>
                      <span className="text-[11px] text-amber-800">
                        لن يرى الزوار موقعك الفعلي. سيقوم النظام بحجب إحداثياتك الحقيقية من واجهة البرمجة (API) وعرض دائرة جغرافية تقريبية فقط.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Images */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Native file upload with client-side compression */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-600 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-center gap-2 font-bold text-emerald-800 text-sm"
                >
                  <Upload className="w-5 h-5 text-emerald-700" />
                  <span>{uploadingImages ? "جاري ضغط ورفع الصور..." : "رفع صور من الكاميرا أو المعرض (ضغط WebP تلقائي)"}</span>
                </button>
                {compressionNotice && (
                  <p className="text-xs text-emerald-800 mt-1.5 text-center font-medium">{compressionNotice}</p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="أو ضع رابط صورة مباشرة (URL)..."
                  value={formData.newImageUrl}
                  onChange={(e) => setFormData({ ...formData, newImageUrl: e.target.value })}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold"
                >
                  إضافة
                </button>
              </div>

              {/* Images Preview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.images.map((img, i) => (
                  <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 group">
                    <NextImage src={img} alt={`صورة ${i + 1}`} fill unoptimized className="object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          images: formData.images.filter((_, idx) => idx !== i),
                        })
                      }
                      className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white text-[10px] font-bold shadow"
                    >
                      حذف
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                        الصورة الرئيسية
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Advertiser Info */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">صفة المعلن *</label>
                <select
                  value={formData.advertiserType}
                  onChange={(e) => setFormData({ ...formData, advertiserType: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="owner">مالك العقار مباشرة</option>
                  <option value="broker">وسيط عقاري مستقل</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف للتواصل *</label>
                <input
                  type="tel"
                  required
                  placeholder="+201001234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.whatsappEnabled}
                    onChange={(e) => setFormData({ ...formData, whatsappEnabled: e.target.checked })}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>السماح بالتواصل الفوري عبر واتساب (WhatsApp)</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6: Review & Submit */}
          {step === 6 && (
            <div className="space-y-4">
              {duplicateWarning && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed font-medium">
                    {duplicateWarning}
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">العنوان:</span>
                  <span className="font-bold text-slate-900">{formData.title || "بدون عنوان"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">السعر:</span>
                  <span className="font-bold text-brand-700">
                    {Number(formData.price || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">المساحة والغرف:</span>
                  <span className="font-bold text-slate-800">
                    {formData.areaSqM} م² • {formData.bedrooms} غرف
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">خصوصية الموقع:</span>
                  <span className="font-bold text-slate-800">
                    {formData.locationPrivacy === "exact" ? "موقع دقيق" : `موقع تقريبي (نطاق ${APPROXIMATE_LOCATION_RADIUS_METERS}م)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">صفة المعلن:</span>
                  <span className="font-bold text-slate-800">
                    {formData.advertiserType === "owner" ? "مالك" : "وسيط عقاري"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 text-xs"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? "جاري الحفظ..." : "تأكيد ونشر الإعلان"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getStepTitle(step: number): string {
  switch (step) {
    case 1:
      return "البيانات الأساسية والسعر";
    case 2:
      return "المواصفات والتشطيب";
    case 3:
      return "الموقع الجغرافي وخصوصية الخريطة";
    case 4:
      return "صور العقار";
    case 5:
      return "بيانات التواصل والمعلن";
    case 6:
      return "فحص التكرار والمراجعة النهائية";
    default:
      return "";
  }
}
