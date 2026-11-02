"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LocationPickerMap from "@/components/map/LocationPickerMap";
import {
  Building2,
  MapPin,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Star,
  Shield,
  Layers,
  Sparkles,
  Info,
  PlusCircle,
  Clock,
  Save,
  RotateCcw,
  GripVertical,
  MoveLeft,
  MoveRight,
  Calculator,
  ArrowUpDown,
  X,
  ChevronLeft,
  Search,
  User as UserIcon,
  ShieldCheck,
  Lock,
  Eye,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { compressImageClientSide, formatBytesArabic } from "@/lib/utils/imageCompression";
import { convertEgyptianUnitsToSqm, convertSqmToEgyptianUnits } from "@/lib/utils/landAreaUnits";
import {
  APPROXIMATE_LOCATION_RADIUS_METERS,
  CATEGORY_LABELS_AR,
  OFFICIAL_PROPERTY_CATEGORIES,
} from "@/lib/db/types";

// Dynamic taxonomy is fetched directly from /api/taxonomy

interface UploadedImage {
  url: string;
  path: string;
  filename: string;
  isMain: boolean;
}

function NewPropertyListingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawAdvertiserType = searchParams.get("advertiserType");

  const [advertiserType, setAdvertiserType] = useState<string>(
    rawAdvertiserType || "owner"
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cities, setCities] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Single-page form — all sections visible at once
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [visitorContactLogged, setVisitorContactLogged] = useState(false);

  const MAX_IMAGES = 6;

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    contactName: "",
    contactPhone: "",
    transactionType: "sale" as "sale" | "rent",
    category: "apartment",
    price: "",
    currency: "EGP",
    rentalPeriod: "monthly",
    negotiable: false,
    hasInstallment: false,
    downPayment: "",
    installmentYears: "5",

    // Specs
    areaSqM: "",
    bedrooms: "",
    bathrooms: "",
    floor: "",
    totalFloors: "",
    hasBuildingPermit: false, // For Land (أراضي)
    finishingStatus: "fully_finished",
    furnishingStatus: "unfurnished",
    parkingSpots: "0",
    hasElevator: false,
    amenities: [] as string[], // Empty by default per host request

    // Location (Dakahlia only)
    cityId: "city-dakahlia",
    districtId: "dist-meet-ghamr-city",
    addressDetails: "مدينة ميت غمر، الدقهلية",
    lat: 30.7194,
    lng: 31.258,
    locationPrivacy: "exact" as "exact" | "approximate",

    // Project Mode & Showcase Specs (Matching Reference Project Showcase)
    isProject: false,
    projectTotalUnits: "18",
    projectMinArea: "325",
    projectMaxArea: "2100",
    projectMinPrice: "70000",
    projectMaxPrice: "290000",
    projectCurrency: "جنيه مصري",
    projectTags: ["متاح", "مكاتب للإيجار", "محل للإيجار", "وحدات جاهزة"] as string[],
    projectLandmarkName: "وسط مدينة ميت غمر",
    projectLandmarkDistance: "1",
    projectSubUnits: [
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
    ] as Array<{
      id: string;
      title: string;
      price: number;
      areaSqM: number;
      category?: string;
      bedrooms?: number;
      image: string;
      locationText: string;
    }>,
  });

  const [newTagInput, setNewTagInput] = useState("");
  const [newSubUnit, setNewSubUnit] = useState({
    title: "",
    price: "",
    areaSqM: "",
    category: "commercial",
  });

  // Predefined default amenities + custom amenities added dynamically by user
  const [availableAmenities, setAvailableAmenities] = useState([
    { key: "security_24_7", label: "أمن وحراسة 24/7" },
    { key: "private_parking", label: "موقف سيارات خاص" },
    { key: "elevator", label: "مصعد كهربائي" },
    { key: "natural_gas", label: "غاز طبيعي" },
    { key: "electricity_meter", label: "عداد كهرباء (قديم / كارت)" },
    { key: "clean_water", label: "مياه شرب نقية" },
    { key: "fiber_internet", label: "خط أرضي وإنترنت فايبر" },
    { key: "balcony", label: "شرفة / تراس واسع" },
    { key: "nile_view", label: "إطلالة على النيل / البحر" },
    { key: "land_share", label: "حصة قانونية في الأرض" },
    { key: "real_estate_registered", label: "تسجيل شهر عقاري / صحة توقيع" },
    { key: "near_services", label: "قريب من المواصلات والخدمات" },
  ]);

  const [newCustomAmenity, setNewCustomAmenity] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Images state
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);

  // Drag & drop image reordering state
  const [draggedImgIdx, setDraggedImgIdx] = useState<number | null>(null);
  const [dragOverImgIdx, setDragOverImgIdx] = useState<number | null>(null);

  // Agricultural Land Unit Converter State (Feddan / Qirat / Sahm)
  const [areaUnitMode, setAreaUnitMode] = useState<"sqm" | "egyptian">("sqm");
  const [landUnits, setLandUnits] = useState({ feddan: "", qirat: "", sahm: "" });

  // Central Database Draft State
  const [draftAvailable, setDraftAvailable] = useState<any | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(false);

  // Check for saved draft in the central database on initial mount
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/dashboard/properties?status=draft", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latestDraft = Array.isArray(data?.properties) && data.properties.length > 0
          ? data.properties[0]
          : null;
        if (latestDraft && !cancelled) {
          setDraftAvailable({
            id: latestDraft.id,
            savedAt: latestDraft.updatedAt || latestDraft.createdAt,
            formData: {
              ...formData,
              title: latestDraft.title || "",
              description: latestDraft.description || "",
              transactionType: latestDraft.transactionType || "sale",
              category: latestDraft.category || "apartment",
              price: latestDraft.price ? String(latestDraft.price) : "",
              areaSqM: latestDraft.areaSqM ? String(latestDraft.areaSqM) : "",
              addressDetails: latestDraft.addressDetails || "",
              lat: latestDraft.lat || formData.lat,
              lng: latestDraft.lng || formData.lng,
              isProject: false,
            },
            images: Array.isArray(latestDraft.images)
              ? latestDraft.images.map((url: string) => ({ url, name: "صورة مرفوعة" }))
              : [],
          });
        }
      } catch (e) {
        console.error("Failed to fetch central draft", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Restore draft handler
  const handleRestoreDraft = () => {
    if (!draftAvailable) return;
    if (draftAvailable.id) {
      setActiveDraftId(draftAvailable.id);
    }
    if (draftAvailable.formData) {
      setFormData({
        ...draftAvailable.formData,
        contactName: draftAvailable.formData.contactName || "",
        contactPhone: draftAvailable.formData.contactPhone || "",
      });
      if (draftAvailable.formData.category === "land" && draftAvailable.formData.areaSqM) {
        const converted = convertSqmToEgyptianUnits(Number(draftAvailable.formData.areaSqM));
        setLandUnits({
          feddan: converted.feddan > 0 ? String(converted.feddan) : "",
          qirat: converted.qirat > 0 ? String(converted.qirat) : "",
          sahm: converted.sahm > 0 ? String(converted.sahm) : "",
        });
      }
    }
    if (draftAvailable.images) setImages(draftAvailable.images);
    if (draftAvailable.areaUnitMode) setAreaUnitMode(draftAvailable.areaUnitMode);
    if (draftAvailable.landUnits) setLandUnits(draftAvailable.landUnits);

    setDraftRestoredNotice(true);
    setDraftAvailable(null);
    setTimeout(() => setDraftRestoredNotice(false), 5000);
  };

  // Discard draft handler (deletes draft from central database)
  const handleDiscardDraft = async () => {
    const draftIdToDelete = draftAvailable?.id || activeDraftId;
    setDraftAvailable(null);
    setActiveDraftId(null);
    setLastAutoSaved(null);
    if (draftIdToDelete) {
      try {
        await apiFetch(`/api/properties/${encodeURIComponent(draftIdToDelete)}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch (e) {
        console.error("Failed to delete central draft", e);
      }
    }
  };

  // Land Unit converter input handlers
  const handleLandUnitChange = (field: "feddan" | "qirat" | "sahm", val: string) => {
    const updated = { ...landUnits, [field]: val };
    setLandUnits(updated);

    const f = parseFloat(updated.feddan) || 0;
    const q = parseFloat(updated.qirat) || 0;
    const s = parseFloat(updated.sahm) || 0;

    if (f > 0 || q > 0 || s > 0) {
      const calculatedSqm = convertEgyptianUnitsToSqm({ feddan: f, qirat: q, sahm: s });
      setFormData((prev) => ({
        ...prev,
        areaSqM: calculatedSqm.toString(),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        areaSqM: "",
      }));
    }
  };

  const handleAreaSqmChange = (val: string) => {
    setFormData((prev) => ({ ...prev, areaSqM: val }));
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      const converted = convertSqmToEgyptianUnits(num);
      setLandUnits({
        feddan: converted.feddan > 0 ? String(converted.feddan) : "",
        qirat: converted.qirat > 0 ? String(converted.qirat) : "",
        sahm: converted.sahm > 0 ? String(converted.sahm) : "",
      });
    } else {
      setLandUnits({ feddan: "", qirat: "", sahm: "" });
    }
  };

  // A visitor may complete the wizard and register contact details before signing in.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        const user = data.user || null;
        setCurrentUser(user);
        if (user) {
          setFormData((prev) => ({
            ...prev,
            contactName: prev.contactName || user.name || "",
            contactPhone: prev.contactPhone || user.phone || "",
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to verify the current user:", error);
        setCurrentUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch taxonomy on mount
  useEffect(() => {
    fetch("/api/taxonomy")
      .then((res) => res.json())
      .then((data) => {
        if (data.cities) setCities(data.cities);
        if (data.districts) setDistricts(data.districts);
      })
      .catch((err) => console.error(err));
  }, []);

  // District selection handler (centers map without wiping manual street details)
  const handleDistrictChange = (distId: string) => {
    const dist = districts.find((d) => d.id === distId);
    const lat = dist?.centerLat || formData.lat;
    const lng = dist?.centerLng || formData.lng;
    const distName = dist?.nameAr || "";

    setFormData((prev) => ({
      ...prev,
      districtId: distId,
      lat,
      lng,
      addressDetails: distName ? `${distName}، مركز ميت غمر` : prev.addressDetails,
    }));
  };

  // Map pin drag or click: updates coordinates ONLY, preserving manual address accuracy
  const handleLocationChange = (newLat: number, newLng: number) => {
    setFormData((prev) => ({
      ...prev,
      lat: newLat,
      lng: newLng,
    }));
  };

  // Optional manual helper to suggest address from map coordinates
  const handleFetchAddressFromCoordinates = async () => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${formData.lat}&lon=${formData.lng}&accept-language=ar`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const road = data.address.road || data.address.suburb || data.address.neighbourhood || "";
          const village = data.address.village || data.address.town || data.address.city || "";
          const parts = [road, village].filter(Boolean);
          const fullAddress = parts.join("، ");
          if (fullAddress) {
            setFormData((prev) => ({
              ...prev,
              addressDetails: fullAddress,
            }));
          }
        }
      }
    } catch {
      // Ignored
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddCustomAmenity = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCustomAmenity.trim();
    if (!trimmed) return;

    const customKey = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setAvailableAmenities((prev) => [...prev, { key: customKey, label: trimmed }]);
    setFormData((prev) => ({
      ...prev,
      amenities: [...prev.amenities, customKey],
    }));
    setNewCustomAmenity("");
  };

  // Batch Image Upload Handler with In-Browser Client-Side Compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingQuota = MAX_IMAGES - images.length;
    if (remainingQuota <= 0) {
      setErrorMsg(`تم الوصول للحد الأقصى لعدد الصور المسموح به (${MAX_IMAGES} صور للمشروع الواحد).`);
      e.target.value = "";
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingQuota);
    if (files.length > remainingQuota) {
      setErrorMsg(`الحد الأقصى هو ${MAX_IMAGES} صور للمشروع. تم اختيار أول ${filesToUpload.length} صور المتاحة بحصتك.`);
    } else {
      setErrorMsg(null);
    }

    setUploadingImage(true);
    setCompressionNotice("جاري فحص الصور وضغطها تلقائياً على جهازك قبل الرفع...");

    try {
      let totalOriginalBytes = 0;
      let totalCompressedBytes = 0;

      // 1. Client-Side Image Compression (WebP / 1920px max)
      const compressedResults = await Promise.all(
        filesToUpload.map(async (file) => {
          totalOriginalBytes += file.size;
          const res = await compressImageClientSide(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.82,
            mimeType: "image/webp",
          });
          totalCompressedBytes += res.compressedSizeBytes;
          return res;
        })
      );

      const savedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
      const ratio = totalOriginalBytes > 0 ? Math.round((savedBytes / totalOriginalBytes) * 100) : 0;
      setCompressionNotice(
        `تم ضغط الصور وتوفير ${ratio}% (من ${formatBytesArabic(totalOriginalBytes)} إلى ${formatBytesArabic(totalCompressedBytes)}). جاري الرفع السحابي...`
      );

      // 2. Upload Compressed WebP Files to Supabase Storage
      const uploadPromises = compressedResults.map(async ({ file }) => {
        const body = new FormData();
        body.append("file", file);
        body.append("propertyId", "draft");

        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          return {
            url: data.url,
            path: data.path,
            filename: data.filename,
          };
        } else {
          throw new Error(data.error || `خطأ في رفع الصورة ${file.name}`);
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulImages: UploadedImage[] = [];
      const failedErrors: string[] = [];

      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          successfulImages.push({
            url: r.value.url,
            path: r.value.path,
            filename: r.value.filename,
            isMain: false,
          });
        } else {
          failedErrors.push(compressedResults[idx].file.name);
        }
      });

      if (successfulImages.length > 0) {
        setImages((prev) => {
          const updated = [...prev, ...successfulImages];
          if (!updated.some((img) => img.isMain) && updated.length > 0) {
            updated[0].isMain = true;
          }
          return updated;
        });
      }

      if (failedErrors.length > 0) {
        setErrorMsg(`فشل رفع بعض الصور (${failedErrors.join("، ")}). يرجى التأكد من اتصال الإنترنت.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "خطأ أثناء رفع الصور، يرجى المحاولة لاحقاً");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // Drag and Drop Image Handlers for Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedImgIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverImgIdx !== index) {
      setDragOverImgIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedImgIdx !== null ? draggedImgIdx : parseInt(e.dataTransfer.getData("text/plain"), 10);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex || sourceIndex < 0 || sourceIndex >= images.length) {
      setDraggedImgIdx(null);
      setDragOverImgIdx(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Index 0 is always the primary cover
    const updated = reordered.map((img, i) => ({
      ...img,
      isMain: i === 0,
    }));

    setImages(updated);
    setDraggedImgIdx(null);
    setDragOverImgIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedImgIdx(null);
    setDragOverImgIdx(null);
  };

  // Touch / Mobile Friendly One-Tap Reordering
  const handleMoveImage = (fromIndex: number, direction: "prev" | "next") => {
    const toIndex = direction === "prev" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setImages(
      reordered.map((img, i) => ({
        ...img,
        isMain: i === 0,
      }))
    );
  };

  // Remove uploaded image
  const handleRemoveImage = async (index: number) => {
    const img = images[index];
    if (img && img.path) {
      try {
        await fetch(`/api/upload?path=${encodeURIComponent(img.path)}`, {
          method: "DELETE",
        });
      } catch (e) {
        // Ignored
      }
    }

    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Ensure at least one image is main
      if (updated.length > 0 && !updated.some((i) => i.isMain)) {
        updated[0].isMain = true;
      }
      return updated;
    });
  };

  // Set as main image
  const handleSetMainImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isMain: i === index,
      }))
    );
  };

  // Amenity toggle
  const toggleAmenity = (key: string) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(key);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== key)
          : [...prev.amenities, key],
      };
    });
  };

  // Submission handler (draft or pending_review)
  const handleSubmitListing = async (targetStatus: "draft" | "pending_review") => {
    if (targetStatus === "pending_review" && !currentUser && visitorContactLogged) {
      return;
    }

    if (formData.isProject) {
      if (!formData.price && formData.projectMinPrice) {
        formData.price = formData.projectMinPrice;
      }
      if (!formData.areaSqM && formData.projectMinArea) {
        formData.areaSqM = formData.projectMinArea;
      }
    }

    if (!formData.title.trim()) {
      setErrorMsg(formData.isProject ? "يرجى كتابة اسم المشروع أو البرج" : "يرجى كتابة عنوان العقار");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formData.description.trim()) {
      setErrorMsg("يرجى كتابة وصف تفصيلي للعقار");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      setErrorMsg("يرجى تحديد السعر المطلوب");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formData.areaSqM || Number(formData.areaSqM) <= 0) {
      setErrorMsg("يرجى تحديد المساحة بالمتر المربع");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formData.addressDetails.trim()) {
      setErrorMsg("يرجى كتابة العنوان وتفاصيل الموقع");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (targetStatus === "pending_review") {
      if (!formData.contactName.trim()) {
        setErrorMsg("يرجى كتابة اسم جهة التواصل");
        return;
      }
      if (!formData.contactPhone.trim()) {
        setErrorMsg("يرجى إدخال رقم هاتف التواصل");
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg(null);
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 10_000);

    const imageUrls = images.map((i) => i.url);
    if (imageUrls.length === 0) {
      imageUrls.push("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80");
    }

    const isLand = formData.category === "land";
    const isHouse = formData.category === "house";
    const isApartment = ["apartment", "duplex", "roof", "ground_floor_garden", "penthouse", "studio"].includes(
      formData.category
    );
    const isVilla = formData.category === "villa";

    try {
      if (targetStatus === "pending_review") {
        const visitorResponse = await apiFetch("/api/visitor-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: formData.contactName.trim(),
            phone: formData.contactPhone.trim(),
            title: formData.title.trim(),
            category: formData.category,
            transactionType: formData.transactionType,
            isProject: formData.isProject,
          }),
          signal: requestController.signal,
        });
        const visitorData = await visitorResponse.json();
        if (!visitorResponse.ok) {
          throw new Error(visitorData.error || "تعذر تسجيل بيانات التواصل");
        }

        if (!currentUser) {
          setVisitorContactLogged(true);
          return;
        }
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        transactionType: formData.transactionType,
        category: formData.category,
        price: Number(formData.price),
        rentalPeriod: formData.transactionType === "rent" ? formData.rentalPeriod : undefined,
        negotiable: Boolean(formData.negotiable),
        downPayment: formData.hasInstallment && formData.downPayment ? Number(formData.downPayment) : undefined,
        installmentYears: formData.hasInstallment && formData.installmentYears ? Number(formData.installmentYears) : undefined,
        areaSqM: Number(formData.areaSqM),
        hasBuildingPermit: isLand ? Boolean(formData.hasBuildingPermit) : undefined,
        bedrooms: !isLand && formData.bedrooms ? Number(formData.bedrooms) : undefined,
        bathrooms: !isLand && formData.bathrooms ? Number(formData.bathrooms) : undefined,
        floor: (isApartment || formData.category === "commercial_retail" || formData.category === "office") && formData.floor ? Number(formData.floor) : undefined,
        totalFloors: (isHouse || isApartment || isVilla) && formData.totalFloors ? Number(formData.totalFloors) : undefined,
        finishingStatus: isLand ? undefined : formData.finishingStatus,
        furnishingStatus: isLand ? undefined : formData.furnishingStatus,
        parkingSpots: Number(formData.parkingSpots || 0),
        hasElevator: isApartment ? formData.hasElevator : false,
        amenities: formData.amenities,
        cityId: "city-dakahlia",
        districtId: formData.districtId,
        addressDetails: formData.addressDetails.trim(),
        lat: Number(formData.lat),
        lng: Number(formData.lng),
        locationPrivacy: formData.locationPrivacy,
        images: imageUrls,
        status: targetStatus,
        advertiserType: advertiserType,
        isProject: formData.isProject,
        contactName: formData.contactName.trim(),
        contactPhone: formData.contactPhone.trim(),
        projectDetails: formData.isProject
          ? {
              totalUnitsCount: Number(formData.projectTotalUnits) || 18,
              minAreaSqM: Number(formData.projectMinArea) || 325,
              maxAreaSqM: Number(formData.projectMaxArea) || 2100,
              minPrice: Number(formData.projectMinPrice) || 70000,
              maxPrice: Number(formData.projectMaxPrice) || 290000,
              tags: formData.projectTags,
              developerLogo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&q=80",
              nearbyLandmarks: [
                {
                  name: formData.projectLandmarkName || "وسط مدينة ميت غمر",
                  distanceKm: Number(formData.projectLandmarkDistance) || 1,
                },
              ],
              subUnits: formData.projectSubUnits,
            }
          : undefined,
      };

      const res = await apiFetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
        signal: requestController.signal,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitSuccess(data.property);
        if (activeDraftId && activeDraftId !== data.property?.id) {
          try {
            await apiFetch(`/api/properties/${encodeURIComponent(activeDraftId)}`, {
              method: "DELETE",
              credentials: "include",
            });
          } catch (e) {}
        }
        setActiveDraftId(null);
      } else {
        setErrorMsg(data.error || "فشل حفظ العقار، يرجى مراجعة البيانات");
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : requestController.signal.aborted
            ? "استغرق إرسال العقار أكثر من 10 ثوانٍ. تحقق من الاتصال ثم أعد المحاولة."
            : "حدث خطأ في الاتصال بالخادم، يرجى إعادة المحاولة"
      );
    } finally {
      window.clearTimeout(requestTimeout);
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <span className="text-sm font-bold text-slate-600">جاري التحقق من هوية الحساب...</span>
      </div>
    );
  }



  if (submitSuccess) {
    const isPending =
      submitSuccess.status === "pending_review" ||
      submitSuccess.status === "pending" ||
      submitSuccess.status === "under_review";
    return (
      <div className="max-w-3xl mx-auto px-4 py-12" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-6">
          <div
            className={`w-16 h-16 ${
              isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-600"
            } rounded-2xl flex items-center justify-center mx-auto shadow-inner`}
          >
            {isPending ? <Lock className="w-9 h-9" /> : <CheckCircle2 className="w-10 h-10" />}
          </div>

          <div className="space-y-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black ${
                isPending
                  ? "bg-amber-500 text-slate-950 border border-amber-600 shadow-xs"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}
            >
              {isPending ? "منشور مقيد 🔒 (بانتظار موافقة الإدارة)" : "مسودة خاصة 📝"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              {submitSuccess.status === "draft"
                ? "تم حفظ العقار كمسودة بنجاح!"
                : "تم إرسال المشروع للإدارة — حالته الآن «منشور مقيد»!"}
            </h1>
            <p className="text-sm text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
              {submitSuccess.status === "draft"
                ? "تم حفظ تفاصيل العقار كمسودة سرية خاصة بك. يمكنك استكمال البيانات وتعديلها في أي وقت من لوحة التحكم."
                : "تم تسجيل مشروعك بنجاح وحالته الحالية «منشور مقيد» لدى إدارة المنصة بانتظار الفحص والموافقة. يظهر المنشور الآن في حسابك في تبويب «منشورات مقيدة»، وفور اعتماد الإدارة له سيتم نشره تلقائياً ليصبح متاحاً للجمهور."}
            </p>

            {/* Notification promise banner */}
            {isPending && (
              <div className="max-w-lg mx-auto flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-right">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-blue-900 leading-relaxed">
                  🔔 سنرسل لك إشعاراً فور موافقة الإدارة على مشروعك — لا تحتاج للمراجعة يدوياً، ستصل التنبيهات إليك مباشرة عند الاعتماد أو في حال طلب أي تعديلات.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-right max-w-md mx-auto space-y-2">
            <div className="text-xs text-slate-400 font-bold">المشروع / العقار المسجل:</div>
            <div className="font-bold text-slate-800 text-sm">{submitSuccess.title}</div>
            <div className="text-xs text-brand-700 font-black flex items-center justify-between">
              <span>{submitSuccess.price?.toLocaleString("ar-EG")} ج.م</span>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-black ${
                  isPending ? "bg-amber-500 text-slate-950 border border-amber-600" : "bg-slate-200 text-slate-700"
                }`}
              >
                {isPending ? "منشور مقيد 🔒" : "مسودة خاصة"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {formData.isProject ? (
              <Link
                href={`/projects/${submitSuccess.id}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm transition shadow-sm flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة صفحة المشروع المقيد 🚀</span>
              </Link>
            ) : null}
            <Link
              href="/dashboard/properties?status=pending_review"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition shadow-sm"
            >
              عرض مشروعي في صفحة المنشورات المقيدة
            </Link>
            <Link
              href="/dashboard?status=pending_review"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
            >
              لوحة التحكم الرئيسية
            </Link>
            <button
              onClick={() => {
                setSubmitSuccess(null);
                setImages([]);
                setFormData((prev) => ({ ...prev, title: "", description: "", price: "", areaSqM: "" }));
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-sm transition border border-slate-200"
            >
              إضافة عقار آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1. Single form page (role picker is embedded at the top of the form)
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-36 space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-700 mb-1">
            <Building2 className="w-4 h-4" />
            <span>لوحة تحكم المعلن • {formData.isProject ? "إضافة مشروع جديد" : "إضافة وحدة جديدة"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {formData.isProject ? "إضافة مشروع / برج عقاري جديد" : "إضافة عقار جديد"}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-slate-600 shrink-0">صفتك:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAdvertiserType("owner")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  advertiserType === "owner"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-400 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>مالك عقار</span>
                {advertiserType === "owner" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                type="button"
                onClick={() => setAdvertiserType("broker")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  advertiserType === "broker"
                    ? "bg-blue-100 text-blue-800 border-blue-400 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>وسيط عقاري</span>
                {advertiserType === "broker" && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1.5">
            أدخل المواصفات المحددة وحدد الموقع على الخريطة لحفظه كمسودة أو نشره للمشترين
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastAutoSaved && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span>محفوظ تلقائياً {lastAutoSaved}</span>
            </span>
          )}
          <Link
            href="/dashboard"
            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
          >
            إلغاء والعودة
          </Link>
        </div>
      </div>

      {/* Draft Restoration Banner */}
      {draftAvailable && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200 text-amber-800 rounded-xl shrink-0">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-amber-950">
                تم العثور على مسودة سابقة محفوظة في قاعدة البيانات المركزية 💾
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {draftAvailable.formData?.title ? `العنوان: "${draftAvailable.formData.title}" • ` : ""}
                {draftAvailable.savedAt ? `آخر تعديل: ${new Date(draftAvailable.savedAt).toLocaleTimeString("ar-EG")}` : ""}
                {draftAvailable.images?.length ? ` • (${draftAvailable.images.length} صور مرفوعة)` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة المسودة</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition"
            >
              تجاهل ومسح
            </button>
          </div>
        </div>
      )}

      {/* Draft Restored Confirmation Notice */}
      {draftRestoredNotice && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>تم استعادة المسودة بنجاح! يمكنك الآن استكمال بياناتك ونشر العقار.</span>
        </div>
      )}

      {/* Single-page form — no wizard steps */}

      {/* Error alert */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: Basic Specifications */}
      {(
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800">
              1. نوع المعاملة والبيانات الأساسية
            </h2>
            {/* Mode Switcher */}
            <button
              type="button"
              disabled
              title="تم إيقاف وضع المشروع مؤقتًا"
              className="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-not-allowed opacity-60 flex items-center gap-1.5 shadow-2xs bg-slate-100 text-slate-700"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>تحويل إلى مشروع / برج 🏢</span>
            </button>
          </div>

          {/* Project Mode Notice & Extra Project Fields */}
          {formData.isProject && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>تهيئة اللوحة التعريفية للمشروع (مطابقة للنموذج المعتمد)</span>
                </span>
                <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md">
                  لوحة تعريفية تفاعلية
                </span>
              </div>

              {/* 1. Project Tags */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">وسوم المشروع التعريفية</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {formData.projectTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white border border-emerald-300 text-emerald-800 shadow-2xs"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            projectTags: prev.projectTags.filter((t) => t !== tag),
                          }))
                        }
                        className="text-slate-400 hover:text-rose-500 text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="أضف وسم جديد (مثال: معارض تجارية، إطلالة بحرية)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTagInput.trim() && !formData.projectTags.includes(newTagInput.trim())) {
                        setFormData((prev) => ({
                          ...prev,
                          projectTags: [...prev.projectTags, newTagInput.trim()],
                        }));
                        setNewTagInput("");
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition"
                  >
                    + إضافة وسم
                  </button>
                </div>
              </div>

              {/* 2. Units Summary Grid */}
              <div className="space-y-2 pt-2 border-t border-emerald-100">
                <label className="block text-xs font-black text-slate-800">تفاصيل الوحدات المتوفرة بالمشروع</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">إجمالي عدد الوحدات</span>
                    <input
                      type="number"
                      value={formData.projectTotalUnits}
                      onChange={(e) => setFormData({ ...formData, projectTotalUnits: e.target.value })}
                      placeholder="18"
                      className="w-full text-xs font-black text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">المساحات (من - إلى م²)</span>
                    <div className="flex items-center gap-1 text-xs">
                      <input
                        type="number"
                        value={formData.projectMinArea}
                        onChange={(e) => setFormData({ ...formData, projectMinArea: e.target.value })}
                        placeholder="من 325"
                        className="w-1/2 text-xs font-black text-slate-800 focus:outline-none"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        value={formData.projectMaxArea}
                        onChange={(e) => setFormData({ ...formData, projectMaxArea: e.target.value })}
                        placeholder="إلى 2100"
                        className="w-1/2 text-xs font-black text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500">نطاق الأسعار (من - إلى جنيه مصري)</span>
                    <div className="flex items-center gap-1 text-xs">
                      <input
                        type="number"
                        value={formData.projectMinPrice}
                        onChange={(e) => setFormData({ ...formData, projectMinPrice: e.target.value })}
                        placeholder="من 70000"
                        className="w-1/2 text-xs font-black text-slate-800 focus:outline-none"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        value={formData.projectMaxPrice}
                        onChange={(e) => setFormData({ ...formData, projectMaxPrice: e.target.value })}
                        placeholder="إلى 290000"
                        className="w-1/2 text-xs font-black text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Nearby Landmark */}
              <div className="space-y-1.5 pt-2 border-t border-emerald-100">
                <label className="block text-xs font-black text-slate-800">أبرز المعالم القريبة والموقع</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.projectLandmarkName}
                    onChange={(e) => setFormData({ ...formData, projectLandmarkName: e.target.value })}
                    placeholder="اسم المعلم القريب داخل مركز ميت غمر"
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.projectLandmarkDistance}
                      onChange={(e) => setFormData({ ...formData, projectLandmarkDistance: e.target.value })}
                      placeholder="المسافة بالكيلومتر (مثال: 1)"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">كم</span>
                  </div>
                </div>
              </div>

              {/* 4. Sub-Units List */}
              <div className="space-y-2 pt-2 border-t border-emerald-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800">الوحدات التابعة للمشروع ({formData.projectSubUnits.length})</label>
                </div>
                <div className="space-y-2">
                  {formData.projectSubUnits.map((unit, uIdx) => (
                    <div key={unit.id} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-black text-slate-800">{unit.title}</span>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          {unit.price.toLocaleString("ar-EG")} ج.م • {unit.areaSqM} م²
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            projectSubUnits: prev.projectSubUnits.filter((_, idx) => idx !== uIdx),
                          }))
                        }
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>

                {/* Quick Add Sub-Unit Form */}
                <div className="p-3 bg-white/70 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 block">+ إضافة وحدة جديدة للمشروع</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="عنوان الوحدة (محل / مكتب / شقة)"
                      value={newSubUnit.title}
                      onChange={(e) => setNewSubUnit({ ...newSubUnit, title: e.target.value })}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="السعر بالجنيه المصري"
                      value={newSubUnit.price}
                      onChange={(e) => setNewSubUnit({ ...newSubUnit, price: e.target.value })}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="المساحة (م²)"
                      value={newSubUnit.areaSqM}
                      onChange={(e) => setNewSubUnit({ ...newSubUnit, areaSqM: e.target.value })}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubUnit.title && newSubUnit.price) {
                        setFormData((prev) => ({
                          ...prev,
                          projectSubUnits: [
                            ...prev.projectSubUnits,
                            {
                              id: `unit-${Date.now()}`,
                              title: newSubUnit.title,
                              price: Number(newSubUnit.price),
                              areaSqM: Number(newSubUnit.areaSqM) || 100,
                              category: newSubUnit.category,
                              image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=500&q=80",
                              locationText: prev.addressDetails || "مدينة ميت غمر، مركز ميت غمر",
                            },
                          ],
                        }));
                        setNewSubUnit({ title: "", price: "", areaSqM: "", category: "commercial" });
                      }
                    }}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    تأكيد إضافة الوحدة للمشروع
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع المعاملة *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, transactionType: "sale" })}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    formData.transactionType === "sale"
                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  للبيع
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, transactionType: "rent" })}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                    formData.transactionType === "rent"
                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  للإيجار
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع العقار *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {OFFICIAL_PROPERTY_CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان العقار التسويقي *</label>
            <input
              type="text"
              placeholder="مثال: قطعة أرض على شارع رئيسي في ميت غمر أو منزل في إحدى القرى"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">الوصف التفصيلي *</label>
            <textarea
              rows={4}
              placeholder="اكتب مواصفات العقار أو الأرض، الأبعاد، الشوارع المحيطة، الواجهة، ترخيص البناء، الخدمات المتوفرة..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed"
            />
          </div>

          {/* Pricing & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">السعر المطلوب (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 2500000"
                min={1}
                max={100_000_000}
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: e.target.value
                      ? String(Math.min(100_000_000, Math.max(1, Number(e.target.value))))
                      : "",
                  })
                }
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className={formData.category === "land" ? "sm:col-span-2 space-y-2" : ""}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  المساحة الإجمالية *
                </label>
                {formData.category === "land" && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAreaUnitMode("sqm")}
                      className={`px-2 py-0.5 rounded-md transition ${
                        areaUnitMode === "sqm"
                          ? "bg-white text-brand-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      بالمتر المربع (م²)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAreaUnitMode("egyptian")}
                      className={`px-2 py-0.5 rounded-md transition ${
                        areaUnitMode === "egyptian"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      فدان / قيراط / سهم 🌾
                    </button>
                  </div>
                )}
              </div>

              {formData.category === "land" && areaUnitMode === "egyptian" ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        فدان (Feddan)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={landUnits.feddan}
                        onChange={(e) => handleLandUnitChange("feddan", e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        قيراط (Qirat)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        placeholder="0"
                        value={landUnits.qirat}
                        onChange={(e) => handleLandUnitChange("qirat", e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                        سهم (Sahm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        placeholder="0"
                        value={landUnits.sahm}
                        onChange={(e) => handleLandUnitChange("sahm", e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {formData.areaSqM && (
                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-emerald-100/70 rounded-xl text-emerald-900 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                        <span>المساحة المحسوبة بقاعدة البيانات:</span>
                      </span>
                      <span className="font-mono text-emerald-800 font-black">
                        {Number(formData.areaSqM).toLocaleString("ar-EG")} م²
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    placeholder="مثال: 175"
                    value={formData.areaSqM}
                    onChange={(e) => handleAreaSqmChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {formData.category === "land" && formData.areaSqM && Number(formData.areaSqM) > 0 && (
                    <div className="text-[11px] text-emerald-700 font-semibold px-2 py-1 bg-emerald-50 rounded-lg flex items-center justify-between">
                      <span>يعادل تقريباً بالوحدات الزراعية:</span>
                      <span className="font-bold">
                        {convertSqmToEgyptianUnits(Number(formData.areaSqM)).summaryArabic}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {formData.transactionType === "rent" ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">دورية الإيجار</label>
                <select
                  value={formData.rentalPeriod}
                  onChange={(e) => setFormData({ ...formData, rentalPeriod: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="monthly">شهرياً</option>
                  <option value="yearly">سنوياً</option>
                  <option value="daily">يومياً (مفروش)</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="negotiable"
                  checked={formData.negotiable}
                  onChange={(e) => setFormData({ ...formData, negotiable: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <label htmlFor="negotiable" className="text-xs font-bold text-slate-700 cursor-pointer">
                  السعر قابل للتفاوض
                </label>
              </div>
            )}
          </div>

          {/* Conditional 1: Land (أراضي) - Building Permit Choice */}
          {formData.category === "land" && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-black text-emerald-950 mb-0.5">
                  تصريح وترخيص البناء *
                </label>
                <p className="text-[11px] text-emerald-800 font-medium">
                  حدد الموقف التنظيمي والرسمي لقطعة الأرض: هل يتوفر لها ترخيص بناء؟
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasBuildingPermit: true })}
                  className={`p-3.5 rounded-xl border text-right transition ${
                    formData.hasBuildingPermit
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-xs">مرخصة للبناء (يوجد ترخيص بناء رسمي) ✅</div>
                  <div className={`text-[11px] mt-0.5 ${formData.hasBuildingPermit ? "text-emerald-100" : "text-slate-500"}`}>
                    الأرض داخل الحيز العمراني ولديها رخصة وتصريح بناء قانوني
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasBuildingPermit: false })}
                  className={`p-3.5 rounded-xl border text-right transition ${
                    !formData.hasBuildingPermit
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-xs">غير مرخصة للبناء (بدون ترخيص حالياً) ⚠️</div>
                  <div className={`text-[11px] mt-0.5 ${!formData.hasBuildingPermit ? "text-amber-100" : "text-slate-500"}`}>
                    أرض فضاء أو لم يصدر لها ترخيص بناء رسمي بعد
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Conditional 2: House (بيت / منزل) - Total Floors */}
          {formData.category === "house" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-black text-brand-900 mb-1.5">
                  عدد الأدوار (إجمالي أدوار المنزل) *
                </label>
                <input
                  type="number"
                  placeholder="مثال: 3 أدوار"
                  min="1"
                  value={formData.totalFloors}
                  onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
                  className="w-full px-3 py-2 bg-brand-50/50 border border-brand-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">إجمالي غرف النوم</label>
                <input
                  type="number"
                  placeholder="مثال: 5"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">إجمالي الحمامات</label>
                <input
                  type="number"
                  placeholder="مثال: 3"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة التشطيب</label>
                <select
                  value={formData.finishingStatus}
                  onChange={(e) => setFormData({ ...formData, finishingStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="ultra_lux">ألترا سوبر لوكس</option>
                  <option value="fully_finished">تشطيب كامل (سوبر لوكس)</option>
                  <option value="semi_finished">نصف تشطيب (محارة وحلوق)</option>
                  <option value="core_and_shell">بدون تشطيب (على الطوب)</option>
                </select>
              </div>
            </div>
          )}

          {/* Conditional 3: Apartment (شقة سكنية) */}
          {["apartment", "duplex", "roof", "ground_floor_garden", "penthouse", "studio"].includes(formData.category) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الدور / الطابق</label>
                <input
                  type="number"
                  placeholder="مثال: 3"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">إجمالي أدوار المبنى</label>
                <input
                  type="number"
                  placeholder="مثال: 6"
                  value={formData.totalFloors}
                  onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">غرف النوم</label>
                <input
                  type="number"
                  placeholder="مثال: 3"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الحمامات</label>
                <input
                  type="number"
                  placeholder="مثال: 2"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة التشطيب</label>
                <select
                  value={formData.finishingStatus}
                  onChange={(e) => setFormData({ ...formData, finishingStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="ultra_lux">ألترا سوبر لوكس</option>
                  <option value="fully_finished">تشطيب كامل (سوبر لوكس)</option>
                  <option value="semi_finished">نصف تشطيب (محارة وحلوق)</option>
                  <option value="core_and_shell">بدون تشطيب (على الطوب)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الفرش</label>
                <select
                  value={formData.furnishingStatus}
                  onChange={(e) => setFormData({ ...formData, furnishingStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="unfurnished">بدون فرش</option>
                  <option value="furnished">مفروش بالكامل</option>
                  <option value="semi_furnished">مفروش جزئياً</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6 col-span-2">
                <input
                  type="checkbox"
                  id="hasElevator"
                  checked={formData.hasElevator}
                  onChange={(e) => setFormData({ ...formData, hasElevator: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <label htmlFor="hasElevator" className="text-xs font-bold text-slate-700 cursor-pointer">
                  يتوفر مصعد كهربائي (أسانسير) بالعمارة
                </label>
              </div>
            </div>
          )}

          {/* Conditional 4: Villa / Commercial / Office */}
          {(formData.category === "villa" || formData.category === "commercial_retail" || formData.category === "office") && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {formData.category === "villa" ? "عدد الأدوار" : "الدور / الطابق"}
                </label>
                <input
                  type="number"
                  placeholder="مثال: 2"
                  value={formData.category === "villa" ? formData.totalFloors : formData.floor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      [formData.category === "villa" ? "totalFloors" : "floor"]: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الحمامات</label>
                <input
                  type="number"
                  placeholder="مثال: 2"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة التشطيب</label>
                <select
                  value={formData.finishingStatus}
                  onChange={(e) => setFormData({ ...formData, finishingStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="ultra_lux">ألترا سوبر لوكس</option>
                  <option value="fully_finished">تشطيب كامل</option>
                  <option value="semi_finished">نصف تشطيب</option>
                  <option value="core_and_shell">بدون تشطيب</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الفرش</label>
                <select
                  value={formData.furnishingStatus}
                  onChange={(e) => setFormData({ ...formData, furnishingStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="unfurnished">بدون فرش</option>
                  <option value="furnished">مفروش بالكامل</option>
                </select>
              </div>
            </div>
          )}

          {/* Amenities Badges */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">المرافق والمزايا المتوفرة</label>
              <span className="text-[11px] text-slate-400">
                ({formData.amenities.length} مزايا مختارة)
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {availableAmenities.map((a) => {
                const isSelected = formData.amenities.includes(a.key);
                const isCustom = a.key.startsWith("custom_");
                return (
                  <div
                    key={a.key}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? "bg-brand-50 border-brand-500 text-brand-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAmenity(a.key)}
                      className="cursor-pointer"
                    >
                      {a.label}
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAvailableAmenities((prev) => prev.filter((item) => item.key !== a.key));
                          setFormData((prev) => ({
                            ...prev,
                            amenities: prev.amenities.filter((k) => k !== a.key),
                          }));
                        }}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-1 text-sm leading-none"
                        title="إزالة هذه الميزة"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Custom Amenity Input */}
            <div className="mt-3.5 flex items-center gap-2 max-w-md">
              <input
                type="text"
                placeholder="أضف ميزة أخرى..."
                value={newCustomAmenity}
                onChange={(e) => setNewCustomAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomAmenity();
                  }
                }}
                className="w-1/4 min-w-28 flex-none px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => handleAddCustomAmenity()}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>إضافة ميزة</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* SECTION 2: Location & Privacy Map */}
      {(
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
            2. الموقع الجغرافي وخريطة التحديد التفاعلية
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">المحافظة *</label>
                <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                  المحافظة الحصرية للنطاق
                </span>
              </div>
              <select
                value="city-dakahlia"
                disabled
                className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-not-allowed"
              >
                <option value="city-dakahlia">مركز ميت غمر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الحي أو القرية (داخل مركز ميت غمر) *</label>
              <select
                value={formData.districtId}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                العنوان التفصيلي واسم الشارع أو المعلم *
              </label>
              <button
                type="button"
                onClick={handleFetchAddressFromCoordinates}
                disabled={geocoding}
                className="text-[11px] text-brand-600 hover:text-brand-800 font-bold underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>استخراج عنوان مقترح من الخريطة (اختياري)</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="اكتب العنوان بدقة: مثال (مدينة ميت غمر - شارع الحرية بجوار البنك الأهلي)"
              value={formData.addressDetails}
              onChange={(e) => setFormData({ ...formData, addressDetails: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              💡 العنوان المكتوب بيدك هنا لن يتغير تلقائياً عند تحريك الدبوس على الخريطة لضمان كتابة الشارع والمعالم بدقة.
            </p>
          </div>

          {/* Interactive Map Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-600" />
                <span>خريطة التحديد المكاني (حدد موقع العقار بدقة)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                [{formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}]
              </span>
            </div>

            <LocationPickerMap
              lat={formData.lat}
              lng={formData.lng}
              isApproximate={formData.locationPrivacy === "approximate"}
              onLocationChange={handleLocationChange}
              zoom={15}
            />
            <p className="text-[11px] text-slate-500">
              يمكنك وضع الدبوس في أي موقع على الخريطة؛ اختيار القرية للتصنيف فقط ولا يقيّد موقع الدبوس.
            </p>
          </div>

          {/* Privacy Option Choice */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-600" />
              <span>خصوصية عرض الموقع على الخريطة العامة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setFormData({ ...formData, locationPrivacy: "exact" })}
                className={`cursor-pointer p-3 rounded-xl border transition ${
                  formData.locationPrivacy === "exact"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs mb-1">
                  <input
                    type="radio"
                    checked={formData.locationPrivacy === "exact"}
                    onChange={() => {}}
                    className="text-emerald-600"
                  />
                  <span>موقع دقيق (Exact Location)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  يظهر الدبوس في موقعه الحقيقي تماماً على الخريطة التفاعلية للباحثين عن عقارات.
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, locationPrivacy: "approximate" })}
                className={`cursor-pointer p-3 rounded-xl border transition ${
                  formData.locationPrivacy === "approximate"
                    ? "bg-amber-50 border-amber-500 text-amber-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs mb-1">
                  <input
                    type="radio"
                    checked={formData.locationPrivacy === "approximate"}
                    onChange={() => {}}
                    className="text-amber-600"
                  />
                  <span>موقع تقريبي (نطاق {APPROXIMATE_LOCATION_RADIUS_METERS}م)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  يقوم النظام بتمويه الإحداثيات وتوفير دائرة نطاق لحماية خصوصية سكن المالك.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SECTION 3: Images & Supabase Storage */}
      {(
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                3. معرض الصور (بحد أقصى {MAX_IMAGES} صور للمشروع)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكنك تحديد عدة صور جملة واحدة من جهازك ورفعها دفعة واحدة
              </p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              images.length >= MAX_IMAGES
                ? "bg-amber-100 text-amber-800"
                : "bg-brand-50 text-brand-700"
            }`}>
              {images.length} من {MAX_IMAGES} صور
            </span>
          </div>

          {/* Compression Status Banner */}
          {compressionNotice && (
            <div className="flex items-center gap-2.5 p-3.5 bg-brand-50 border border-brand-200 rounded-2xl text-brand-900 text-xs font-bold animate-in fade-in shadow-2xs">
              <Sparkles className="w-4 h-4 text-brand-600 shrink-0 animate-pulse" />
              <span>{compressionNotice}</span>
            </div>
          )}

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-8 text-center transition bg-slate-50/50">
            <input
              type="file"
              id="property-image-input"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileUpload}
              disabled={uploadingImage || images.length >= MAX_IMAGES}
              className="hidden"
            />
            <label
              htmlFor="property-image-input"
              className={`cursor-pointer flex flex-col items-center justify-center gap-2 ${
                images.length >= MAX_IMAGES ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl shadow-sm">
                {uploadingImage ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8" />
                )}
              </div>
              <div className="font-bold text-slate-800 text-sm">
                {uploadingImage
                  ? "جاري فحص وضغط ورفع الصور..."
                  : images.length >= MAX_IMAGES
                  ? `تم الوصول للحد الأقصى (${MAX_IMAGES} صور)`
                  : "انقر لاختيار حتى 6 صور جملة واحدة أو اسحبها هنا"}
              </div>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                ⚡ يتم ضغط الصور تلقائياً على جهازك قبل الرفع لتقليل حجمها بنسبة تصل إلى 85% مع الحفاظ على أعلى جودة.
              </p>
              <p className="text-[11px] text-slate-400">
                الأنواع المدعومة: JPG, PNG, WEBP, AVIF (متبقي لك {MAX_IMAGES - images.length} صور)
              </p>
            </label>
          </div>

          {/* Preview Gallery Grid with Drag & Drop Reordering */}
          {images.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <GripVertical className="w-4 h-4 text-brand-600" />
                  <span>ترتيب الصور بالسحب والإفلات (الصورة الأولى هي الغلاف دائماً):</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  💡 اسحب الصورة وأفلتها في المكان المطلوب، أو استخدم الأسهم
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {images.map((img, idx) => {
                  const isDragging = draggedImgIdx === idx;
                  const isDragOver = dragOverImgIdx === idx && draggedImgIdx !== idx;

                  return (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 group cursor-grab active:cursor-grabbing select-none ${
                        isDragging ? "opacity-30 scale-95" : ""
                      } ${
                        isDragOver ? "border-brand-500 ring-4 ring-brand-200 scale-105 shadow-lg" : ""
                      } ${
                        img.isMain
                          ? "border-brand-600 ring-2 ring-brand-100 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-32 object-cover bg-slate-100 pointer-events-none"
                      />

                      {/* Number and Main Badge */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        {img.isMain ? (
                          <div className="bg-brand-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>الغلاف ⭐</span>
                          </div>
                        ) : (
                          <div className="bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            #{idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Drag Grip Handle */}
                      <div className="absolute top-1.5 left-1.5 p-1 rounded bg-black/40 text-white/90 group-hover:bg-black/60 transition shadow-2xs">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Bottom Quick-Action Toolbar (Reordering & Delete) */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-1.5 flex items-center justify-between opacity-90 group-hover:opacity-100 transition">
                        <div className="flex items-center gap-0.5">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, "prev")}
                              className="p-1 rounded bg-white/20 hover:bg-white text-white hover:text-slate-900 transition text-[10px]"
                              title="تحريك للخلف (أقرب للغلاف)"
                            >
                              <MoveRight className="w-3 h-3" />
                            </button>
                          )}
                          {idx < images.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, "next")}
                              className="p-1 rounded bg-white/20 hover:bg-white text-white hover:text-slate-900 transition text-[10px]"
                              title="تحريك للأمام"
                            >
                              <MoveLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {!img.isMain && (
                            <button
                              type="button"
                              onClick={() => handleSetMainImage(idx)}
                              className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition"
                              title="تعيين كغلاف رئيسي"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SECTION 4: Review & Final Actions */}
      {(
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
            4. مراجعة تفاصيل العقار وتأكيد الإرسال
          </h2>

          {/* Quick Review Card */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800">
                  {formData.transactionType === "sale" ? "للبيع" : "للإيجار"} • {CATEGORY_LABELS_AR[formData.category] || formData.category}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-2">{formData.title}</h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  <span>{formData.addressDetails}</span>
                </div>
              </div>

              <div className="text-left">
                <div className="text-xl font-black text-brand-800">
                  {Number(formData.price || 0).toLocaleString("ar-EG")} ج.م
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">
                  {formData.areaSqM} م²
                  {formData.category === "land" ? (
                    <>
                      <span className="mr-1 text-emerald-800 font-bold">
                        ({convertSqmToEgyptianUnits(Number(formData.areaSqM)).summaryArabic})
                      </span>
                      <span className="mr-1.5 text-emerald-700 font-bold">
                        • {formData.hasBuildingPermit ? "مرخصة للبناء ✅" : "بدون ترخيص بناء ⚠️"}
                      </span>
                    </>
                  ) : formData.category === "house" ? (
                    <span className="mr-1.5 font-bold">
                      • {formData.totalFloors || 1} أدوار
                    </span>
                  ) : ["apartment", "duplex", "roof", "ground_floor_garden", "penthouse", "studio"].includes(formData.category) ? (
                    <span className="mr-1.5">
                      • الدور {formData.floor || "-"} {formData.bedrooms ? `• ${formData.bedrooms} غرف` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
              {formData.description}
            </p>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pt-2 border-t border-slate-200">
              <Info className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                نوع الخصوصية: {formData.locationPrivacy === "exact" ? "موقع دقيق للجمهور" : `موقع تقريبي (نطاق ${APPROXIMATE_LOCATION_RADIUS_METERS}م)`} • الصور: {images.length} صورة من أصل 6 • المزايا المختارة: {formData.amenities.length}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">بيانات التواصل</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                أدخل الاسم ورقم الهاتف لإرسالهما إلى الإدارة مع طلب العقار. يمكن تعديل البيانات المعبأة من حسابك.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                اسم جهة التواصل *
                <input
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="off"
                  value={formData.contactName}
                  onChange={(event) => {
                    setVisitorContactLogged(false);
                    setFormData({ ...formData, contactName: event.target.value });
                  }}
                  placeholder="اكتب الاسم الذي سيظهر للإدارة"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 font-medium"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                رقم هاتف التواصل *
                <input
                  type="tel"
                  required
                  maxLength={20}
                  autoComplete="off"
                  dir="ltr"
                  value={formData.contactPhone}
                  onChange={(event) => {
                    setVisitorContactLogged(false);
                    setFormData({ ...formData, contactPhone: event.target.value });
                  }}
                  placeholder="+201001234567"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-left font-medium"
                />
              </label>
            </div>
            <p className="text-[11px] font-medium text-slate-500">الاسم ورقم الهاتف مطلوبان قبل إرسال الطلب للمراجعة.</p>
          </div>

          {visitorContactLogged && (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold">تم تسجيل بياناتك في سجل الزوار. سجّل الدخول لإكمال إرسال العقار.</p>
              <Link
                href={`/login?redirect=${encodeURIComponent("/dashboard/properties/new")}`}
                className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"
              >
                تسجيل الدخول للمتابعة
              </Link>
            </div>
          )}

          {/* Dual Action Buttons (Draft vs Submit to Admin Restricted Registry) */}
          <div className="p-4 bg-brand-50/60 border border-brand-100 rounded-2xl space-y-4">
            <div className="text-xs font-bold text-brand-900">اختر طريقة الحفظ والإرسال:</div>
            <div className={`grid grid-cols-1 gap-4 ${currentUser ? "sm:grid-cols-2" : ""}`}>
              {currentUser && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmitListing("draft")}
                  className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-right transition group disabled:opacity-50"
                >
                  <div className="font-bold text-xs text-slate-800 mb-1 flex items-center justify-between">
                    <span>حفظ كمسودة خاصة</span>
                    <span className="text-[10px] text-slate-400 font-mono">DRAFT</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يُحفظ العقار في لوحة تحكمك فقط ولا يُعرض للإدارة أو الجمهور. يمكنك تعديله واستكماله لاحقاً.
                  </p>
                </button>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitListing("pending_review")}
                className="p-4 bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white rounded-xl text-right transition shadow-md disabled:opacity-50 relative overflow-hidden"
              >
                <div className="font-bold text-xs mb-1 flex items-center justify-between">
                  <span className="font-black text-white">إرسال للإدارة للمراجعة 🚀</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <p className="text-[11px] text-brand-100 leading-relaxed">
                  يُرسل المشروع للإدارة في <strong>سجل المشاريع المقيدة</strong>، ويُسجل بحسابك في <strong>بند قيد المراجعة</strong>. وبمجرد الموافقة يخرج من المقيدة ويتحول لعقارات منشورة.
                </p>
              </button>
            </div>
          </div>

          {submitting && (
              <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري معالجة وحفظ العقار...</span>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default function NewPropertyListingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
          <span className="text-xs text-slate-500 font-bold">جاري تجهيز نموذج إضافة العقار...</span>
        </div>
      }
    >
      <NewPropertyListingInner />
    </Suspense>
  );
}
