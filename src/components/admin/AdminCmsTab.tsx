"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import {
  Palette,
  Sparkles,
  Building2,
  Compass,
  Shield,
  Home,
  Crown,
  Layers,
  MapPin,
  Save,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Type,
  Sliders,
  Smartphone,
  Eye,
  AlertCircle,
} from "lucide-react";
import { CmsHomepageSettings, VisualIdentitySettings } from "@/lib/db/types";
import {
  DEFAULT_BRAND_LOGO_HEIGHT_PX,
  DEFAULT_BRAND_LOGO_PATH,
  DEFAULT_VISUAL_IDENTITY,
  MAX_BRAND_LOGO_HEIGHT_PX,
  MIN_BRAND_LOGO_HEIGHT_PX,
  getBrandLogoHeightPx,
  getBrandThemeStyle,
} from "@/lib/brand-theme";

const COLOR_PRESETS: Array<{
  id: VisualIdentitySettings["colorSchemePreset"];
  name: string;
  primary: string;
  hover: string;
  secondary: string;
  accent: string;
}> = [
  { id: "emerald_pulse", name: "زمردي", primary: "#059669", hover: "#047857", secondary: "#0f172a", accent: "#10b981" },
  { id: "royal_blue", name: "أزرق ملكي", primary: "#2563eb", hover: "#1d4ed8", secondary: "#172554", accent: "#38bdf8" },
  { id: "luxury_gold", name: "ذهبي فاخر", primary: "#b45309", hover: "#92400e", secondary: "#1c1917", accent: "#f59e0b" },
  { id: "modern_indigo", name: "نيلي عصري", primary: "#4f46e5", hover: "#4338ca", secondary: "#1e1b4b", accent: "#818cf8" },
  { id: "midnight_slate", name: "رمادي داكن", primary: "#334155", hover: "#1e293b", secondary: "#020617", accent: "#94a3b8" },
];

const LOGO_ICONS: Array<{
  id: VisualIdentitySettings["logoIcon"];
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = [
  { id: "building", label: "مبنى", icon: Building2 },
  { id: "home", label: "منزل", icon: Home },
  { id: "map_pin", label: "موقع", icon: MapPin },
  { id: "sparkles", label: "بريق", icon: Sparkles },
  { id: "compass", label: "بوصلة", icon: Compass },
  { id: "shield", label: "أمان", icon: Shield },
  { id: "crown", label: "تاج", icon: Crown },
  { id: "layers", label: "طبقات", icon: Layers },
];

export default function AdminCmsTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // Identity Form states
  const [siteName, setSiteName] = useState(DEFAULT_VISUAL_IDENTITY.siteName || "دار العقار");
  const [siteSubtitle, setSiteSubtitle] = useState(DEFAULT_VISUAL_IDENTITY.siteSubtitle || "Dar Al Aqar Egypt");
  const [logoType, setLogoType] = useState<VisualIdentitySettings["logoType"]>("image");
  const [logoIcon, setLogoIcon] = useState<VisualIdentitySettings["logoIcon"]>("building");
  const [logoImageUrl, setLogoImageUrl] = useState(DEFAULT_BRAND_LOGO_PATH);
  const [logoHeightPx, setLogoHeightPx] = useState(DEFAULT_BRAND_LOGO_HEIGHT_PX);
  const [appIconUrl, setAppIconUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [primaryHoverColor, setPrimaryHoverColor] = useState("#047857");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [iconColor, setIconColor] = useState("#059669");
  const [mapIconColor, setMapIconColor] = useState("#047857");
  const [colorSchemePreset, setColorSchemePreset] = useState<VisualIdentitySettings["colorSchemePreset"]>("emerald_pulse");
  const [headingWeight, setHeadingWeight] = useState<VisualIdentitySettings["headingWeight"]>("bold");
  const [fontFamily, setFontFamily] = useState<VisualIdentitySettings["fontFamily"]>("cairo");
  const [borderRadius, setBorderRadius] = useState<VisualIdentitySettings["borderRadius"]>("curved");
  const [headerBackground, setHeaderBackground] = useState<VisualIdentitySettings["headerBackground"]>("white");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAppIcon, setUploadingAppIcon] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const fetchCmsSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const res = await fetch("/api/admin/cms/settings", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذر تحميل إعدادات الهوية والمحتوى");
      }

      const s: CmsHomepageSettings = data.settings;
      if (data.persistenceAvailable === false) {
        setNoticeMsg(data.error || "الذاكرة الحالية مؤقتة أو لم يتم ربط قاعدة البيانات المركزية بعد.");
      }

      if (s?.visualIdentity) {
        const vi = s.visualIdentity as VisualIdentitySettings;
        setSiteName(vi.siteName || "دار العقار");
        setSiteSubtitle(vi.siteSubtitle || "Dar Al Aqar Egypt");
        setLogoType(vi.logoType || "image");
        setLogoIcon(vi.logoIcon || "building");
        setLogoImageUrl(vi.logoImageUrl || DEFAULT_BRAND_LOGO_PATH);
        setLogoHeightPx(getBrandLogoHeightPx(vi));
        setAppIconUrl(vi.appIconUrl || "");
        setFaviconUrl(vi.faviconUrl || "");
        setPrimaryColor(vi.primaryColor || "#059669");
        setPrimaryHoverColor(vi.primaryHoverColor || "#047857");
        setSecondaryColor(vi.secondaryColor || "#0f172a");
        setAccentColor(vi.accentColor || "#10b981");
        setIconColor(vi.iconColor || "#059669");
        setMapIconColor(vi.mapIconColor || "#047857");
        setColorSchemePreset(vi.colorSchemePreset || "emerald_pulse");
        setHeadingWeight(vi.headingWeight || "bold");
        setFontFamily(vi.fontFamily || "cairo");
        setBorderRadius(vi.borderRadius || "curved");
        setHeaderBackground(vi.headerBackground || "white");
      }
      setLoadError(false);
    } catch (err) {
      console.error("Failed to fetch CMS settings:", err);
      setLoadError(true);
      setErrorMsg(err instanceof Error ? err.message : "تعذر تحميل إعدادات الهوية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCmsSettings();
  }, []);

  const handleApplyPreset = (preset: (typeof COLOR_PRESETS)[number]) => {
    setColorSchemePreset(preset.id);
    setPrimaryColor(preset.primary);
    setPrimaryHoverColor(preset.hover);
    setSecondaryColor(preset.secondary);
    setAccentColor(preset.accent);
    setIconColor(preset.primary);
    setMapIconColor(preset.hover);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "logo" | "appIcon" | "favicon"
  ) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const input = event.currentTarget;
    const setUploading =
      target === "logo" ? setUploadingLogo : target === "appIcon" ? setUploadingAppIcon : setUploadingFavicon;

    setUploading(true);
    setErrorMsg(null);
    try {
      if (target === "appIcon") {
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const objectUrl = URL.createObjectURL(file);
          const image = document.createElement("img");
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ width: image.width, height: image.height });
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("تعذر قراءة أبعاد الصورة"));
          };
          image.src = objectUrl;
        });
        const isSquare = dimensions.width === dimensions.height;
        const isLargeEnough = dimensions.width >= 192;
        if (!isSquare || !isLargeEnough) {
          throw new Error("يجب أن تكون أيقونة التطبيق مربعة وبأبعاد لا تقل عن 192×192 بكسل");
        }
      }

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("propertyId", "draft");
      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: uploadData,
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || "فشل رفع الصورة");
      }
      if (target === "logo") setLogoImageUrl(result.url);
      else if (target === "appIcon") setAppIconUrl(result.url);
      else setFaviconUrl(result.url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      // 1. Fetch current settings with credentials
      const currentRes = await fetch("/api/admin/cms/settings", {
        cache: "no-store",
        credentials: "include",
      });
      if (!currentRes.ok) throw new Error("تعذر جلب الإعدادات الحالية من الخادم قبل الحفظ");
      const currentData = await currentRes.json();
      const current: CmsHomepageSettings = currentData.settings || {};
      const currentVi = (current?.visualIdentity || {}) as VisualIdentitySettings;

      const visualIdentity: VisualIdentitySettings = {
        ...currentVi,
        siteName,
        siteSubtitle,
        logoType,
        logoIcon,
        logoImageUrl,
        logoHeightPx,
        appIconUrl,
        faviconUrl,
        primaryColor,
        primaryHoverColor,
        secondaryColor,
        accentColor,
        iconColor,
        mapIconColor,
        headerBackground,
        colorSchemePreset,
        fontFamily,
        headingWeight,
        borderRadius,
      };

      const payload: Partial<CmsHomepageSettings> = {
        ...current,
        visualIdentity,
        navLabels: {
          ...(current.navLabels || {}),
          brandTitle: siteName,
          brandSubtitle: siteSubtitle,
        },
      };

      // 2. Try saving to PUT /api/admin/cms/settings first
      let saveRes = await fetch("/api/admin/cms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      // 3. Fallback to PUT /api/cms/homepage if needed
      if (!saveRes.ok) {
        saveRes = await fetch("/api/cms/homepage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (saveRes.ok) {
        const result = await saveRes.json();
        if (result.settings?.visualIdentity?.logoHeightPx) {
          setLogoHeightPx(getBrandLogoHeightPx(result.settings.visualIdentity));
        }
        setSaveSuccess(true);
        window.dispatchEvent(new Event("cms-settings-updated"));
        router.refresh();
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        const d = await saveRes.json().catch(() => ({}));
        throw new Error(d.error || "فشل حفظ إعدادات الهوية في الخادم");
      }
    } catch (err) {
      console.error("Save CMS Error:", err);
      setErrorMsg(err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء حفظ الإعدادات");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const renderIconPreview = () => {
    const IconCmp = LOGO_ICONS.find((i) => i.id === logoIcon)?.icon || Building2;
    return <IconCmp className="w-5 h-5" style={{ color: iconColor }} />;
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-purple-700 text-xs font-black uppercase tracking-wider mb-1">
            <Palette className="w-4 h-4" />
            <span>شركة الإدارة • الهوية البصرية والعلامة التجارية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة الهوية البصرية والشعار والألوان
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            التحكم الشامل في اسم المنصة، الشعار، الأيقونة، درجات الألوان، والخطوط على مستوى جميع الواجهات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loadError && (
            <button
              type="button"
              onClick={() => void fetchCmsSettings()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة التحميل</span>
            </button>
          )}

          <button
            type="submit"
            disabled={saving || loading || uploadingLogo || uploadingAppIcon || uploadingFavicon}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md shadow-purple-700/20 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ والتطبيق...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات فوراً</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>تم حفظ الهوية البصرية وتطبيق الألوان والشعار بنجاح في المنصة!</span>
        </div>
      )}
      {noticeMsg && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{noticeMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Live Interactive Brand Preview Box */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>معاينة حية وفورية للهوية والشعار والعناصر</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
            معاينة مباشرة
          </span>
        </div>

        <div
          style={getBrandThemeStyle({
            ...DEFAULT_VISUAL_IDENTITY,
            primaryColor,
            primaryHoverColor,
            secondaryColor,
            accentColor,
            iconColor,
            mapIconColor,
            fontFamily,
            headingWeight,
            borderRadius,
          })}
        >
          <div
            style={{
              backgroundColor: headerBackground === "dark" ? secondaryColor : "#ffffff",
              borderColor: headerBackground === "dark" ? secondaryColor : "#e2e8f0",
            }}
            className="w-full rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            {/* Logo preview */}
            <div className="flex items-center gap-3">
              {logoType === "image" ? (
                <NextImage
                  src={logoImageUrl || DEFAULT_BRAND_LOGO_PATH}
                  alt={siteName}
                  width={144}
                  height={74}
                  unoptimized
                  style={{ height: `${logoHeightPx}px`, width: "auto" }}
                  className="rounded-xl border border-slate-200 bg-white object-contain p-1"
                />
              ) : logoType !== "text_only" ? (
                <div
                  style={{ backgroundColor: primaryColor }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md text-white"
                >
                  {renderIconPreview()}
                </div>
              ) : null}

              {logoType !== "image" && (
                <div style={{ color: headerBackground === "dark" ? "#ffffff" : "#0f172a" }}>
                  <div
                    style={{
                      fontWeight: headingWeight === "bold" ? 700 : headingWeight === "extrabold" ? 800 : 900,
                    }}
                    className="text-base tracking-tight"
                  >
                    {siteName}
                  </div>
                  <p style={{ color: accentColor }} className="text-[11px] font-medium">
                    {siteSubtitle}
                  </p>
                </div>
              )}
            </div>

            {/* Sample UI chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{ backgroundColor: primaryColor }}
                className="px-3 py-1.5 rounded-xl text-white text-xs font-black shadow-xs"
              >
                زر رئيسي
              </span>
              <span
                style={{ backgroundColor: iconColor }}
                className="px-3 py-1.5 rounded-xl text-white text-xs font-black shadow-xs"
              >
                أيقونات الواجهة
              </span>
              <span
                style={{ backgroundColor: mapIconColor }}
                className="px-3 py-1.5 rounded-full text-white text-xs font-black shadow-xs"
              >
                علامة الخريطة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Settings Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel A: اسم المنصة والشعار */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base pb-3 border-b border-slate-100">
            <ImageIcon className="w-4 h-4 text-purple-700" />
            <span>اسم المنصة ونمط الشعار</span>
          </div>

          <div className="space-y-4 text-xs font-bold text-slate-700">
            {/* Site Name & Subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5">اسم الموقع باللغة العربية</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="دار العقار"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="block mb-1.5">الوصف الفرعي أو الترجمة</label>
                <input
                  type="text"
                  value={siteSubtitle}
                  onChange={(e) => setSiteSubtitle(e.target.value)}
                  placeholder="Dar Al Aqar Egypt"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Logo Type Selector */}
            <div>
              <label className="block mb-2">نمط عرض الشعار في شريط التصفح</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "image", label: "صورة الشعار الرسمية" },
                  { id: "icon_text", label: "أيقونة + نص الاسم" },
                  { id: "text_only", label: "نص الاسم فقط" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setLogoType(type.id as VisualIdentitySettings["logoType"])}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      logoType === type.id
                        ? "bg-purple-50 text-purple-800 border-purple-600 ring-2 ring-purple-600/20 font-black"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Icon Picker (if icon_text) */}
            {logoType === "icon_text" && (
              <div>
                <label className="block mb-2">أيقونة الشعار</label>
                <div className="grid grid-cols-4 gap-2">
                  {LOGO_ICONS.map((ic) => {
                    const IconComponent = ic.icon;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => setLogoIcon(ic.id)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          logoIcon === ic.id
                            ? "bg-purple-50 text-purple-800 border-purple-600 ring-2 ring-purple-600/20"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span className="text-[10px] font-bold">{ic.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Image URL & Upload */}
            <div>
              <label className="block mb-1.5">صورة الشعار (URL أو مسار في /branding)</label>
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <NextImage
                  src={logoImageUrl || DEFAULT_BRAND_LOGO_PATH}
                  alt="معاينة الشعار"
                  width={144}
                  height={74}
                  unoptimized
                  style={{ height: `${logoHeightPx}px`, width: "auto" }}
                  className="rounded-xl border border-slate-200 bg-white object-contain"
                />
                <span className="text-[11px] text-slate-500">معاينة مباشرة بالحجم المختار ({logoHeightPx}px)</span>
              </div>
              <input
                type="text"
                value={logoImageUrl}
                onChange={(e) => setLogoImageUrl(e.target.value)}
                placeholder="/branding/dar-al-aqar.png أو https://..."
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white text-left"
              />
              <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 cursor-pointer transition-colors">
                <ImageIcon className="w-4 h-4" />
                <span>{uploadingLogo ? "جارٍ رفع الشعار..." : "رفع صورة شعار جديدة"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  disabled={uploadingLogo}
                  onChange={(event) => void handleImageUpload(event, "logo")}
                  className="sr-only"
                />
              </label>

              {/* Slider */}
              <label className="mt-4 block space-y-2">
                <span className="flex items-center justify-between">
                  <span>ارتفاع الشعار بالبكسل</span>
                  <span className="text-purple-700" dir="ltr">
                    {logoHeightPx}px
                  </span>
                </span>
                <input
                  type="range"
                  min={MIN_BRAND_LOGO_HEIGHT_PX}
                  max={MAX_BRAND_LOGO_HEIGHT_PX}
                  step={4}
                  value={logoHeightPx}
                  disabled={saving}
                  onChange={(event) => setLogoHeightPx(Number(event.target.value))}
                  className="w-full accent-purple-700 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                  aria-label="حجم الشعار بالبكسل"
                />
                <span className="flex justify-between text-[10px] text-slate-500" dir="ltr">
                  <span>{MIN_BRAND_LOGO_HEIGHT_PX}px</span>
                  <span>{MAX_BRAND_LOGO_HEIGHT_PX}px</span>
                </span>
              </label>
            </div>

            {/* App Icon & Favicon */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div>
                <label className="block mb-1.5">أيقونة التطبيق المثبت (PWA / Mobile)</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  صورة مربعة 192×192 بكسل على الأقل لتظهر عند تثبيت التطبيق على الهواتف.
                </p>
                {appIconUrl && (
                  <div className="mb-2 flex items-center gap-3">
                    <NextImage
                      src={appIconUrl}
                      alt="معاينة أيقونة التطبيق"
                      width={64}
                      height={64}
                      unoptimized
                      className="w-16 h-16 rounded-xl border border-slate-200 object-contain bg-white"
                    />
                    <span className="text-[11px] text-slate-500">معاينة أيقونة التطبيق</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 cursor-pointer transition-colors">
                  <Smartphone className="w-4 h-4" />
                  <span>{uploadingAppIcon ? "جارٍ رفع الأيقونة..." : "رفع أيقونة التطبيق"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    disabled={uploadingAppIcon}
                    onChange={(event) => void handleImageUpload(event, "appIcon")}
                    className="sr-only"
                  />
                </label>
                <input
                  type="text"
                  value={appIconUrl}
                  onChange={(e) => setAppIconUrl(e.target.value)}
                  placeholder="رابط HTTPS أو مسار أيقونة التطبيق"
                  dir="ltr"
                  className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white text-left"
                />
              </div>

              <div>
                <label className="block mb-1.5">أيقونة شريط المتصفح (Favicon)</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  أيقونة التبويب في المتصفح. إذا تُركت فارغة تُستخدم أيقونة التطبيق.
                </p>
                {faviconUrl && (
                  <div className="mb-2 flex items-center gap-3">
                    <NextImage
                      src={faviconUrl}
                      alt="معاينة الفافيكون"
                      width={32}
                      height={32}
                      unoptimized
                      className="w-8 h-8 rounded-lg border border-slate-200 object-contain bg-white"
                    />
                    <span className="text-[11px] text-slate-500">معاينة أيقونة المتصفح</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 cursor-pointer transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span>{uploadingFavicon ? "جارٍ رفع الفافيكون..." : "رفع أيقونة المتصفح"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
                    disabled={uploadingFavicon}
                    onChange={(event) => void handleImageUpload(event, "favicon")}
                    className="sr-only"
                  />
                </label>
                <input
                  type="text"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="/favicon.ico أو رابط أيقونة المتصفح"
                  dir="ltr"
                  className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white text-left"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel B: ألوان الهوية والخطوط */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 text-slate-900 font-black text-base pb-3 border-b border-slate-100">
            <Palette className="w-4 h-4 text-purple-700" />
            <span>نظام الألوان والخطوط</span>
          </div>

          <div className="space-y-4 text-xs font-bold text-slate-700">
            {/* Color Presets */}
            <div>
              <label className="block mb-2">باليتات ألوان جاهزة ومختارة</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                      colorSchemePreset === preset.id
                        ? "bg-purple-50 border-purple-600 ring-2 ring-purple-600/20"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: preset.primary }}
                      className="w-4 h-4 rounded-full border border-white shadow-xs shrink-0"
                    />
                    <span className="text-[11px] font-bold text-slate-900">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="space-y-1.5">
                <span className="block">اللون الأساسي للعلامة</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block">لون التحويم (Hover)</span>
                <input
                  type="color"
                  value={primaryHoverColor}
                  onChange={(e) => {
                    setPrimaryHoverColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={primaryHoverColor}
                  onChange={(e) => {
                    setPrimaryHoverColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block">اللون الثانوي</span>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => {
                    setSecondaryColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => {
                    setSecondaryColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block">لون التمييز (Accent)</span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    setColorSchemePreset("custom");
                  }}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block">لون أيقونات الواجهة</span>
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block">لون علامات الخريطة</span>
                <input
                  type="color"
                  value={mapIconColor}
                  onChange={(e) => setMapIconColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                />
                <input
                  type="text"
                  value={mapIconColor}
                  onChange={(e) => setMapIconColor(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-left"
                />
              </label>
            </div>

            {/* Typography & Style */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-purple-700" />
                    <span>نوع الخط العربي</span>
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as VisualIdentitySettings["fontFamily"])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="cairo">خط كايرو (Cairo - افتراضي)</option>
                    <option value="alexandria">خط الإسكندرية (Alexandria)</option>
                    <option value="tajawal">خط تجوال (Tajawal)</option>
                    <option value="almarai">خط المراعي (Almarai)</option>
                    <option value="ibm_plex">خط IBM Plex Sans Arabic</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-700" />
                    <span>سماكة العناوين</span>
                  </label>
                  <select
                    value={headingWeight}
                    onChange={(e) => setHeadingWeight(e.target.value as VisualIdentitySettings["headingWeight"])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="bold">عريض (Bold 700)</option>
                    <option value="extrabold">فائق العرض (ExtraBold 800)</option>
                    <option value="black">أسود داكن (Black 900)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5">نمط الحواف والزوايا</label>
                  <select
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value as VisualIdentitySettings["borderRadius"])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="curved">منحنية عصرية (Curved)</option>
                    <option value="soft">ناعمة خفيفة (Soft)</option>
                    <option value="rounded">مستديرة كاملة (Rounded)</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5">نمط خلفية شريط التصفح</label>
                  <select
                    value={headerBackground}
                    onChange={(e) => setHeaderBackground(e.target.value as VisualIdentitySettings["headerBackground"])}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="white">أبيض ناصع (White)</option>
                    <option value="glass">زجاجي شفاف (Glass)</option>
                    <option value="dark">داكن (Dark)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Sticky Save Bar */}
      <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-600 text-center sm:text-right">
          يتم تطبيق التعديلات والشعار فوراً على كافة صفحات وزوار المنصة ومحركات البحث.
        </span>

        <button
          type="submit"
          disabled={saving || loading || uploadingLogo || uploadingAppIcon || uploadingFavicon}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md shadow-purple-700/20 cursor-pointer shrink-0 w-full sm:w-auto"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري الحفظ والتطبيق...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>حفظ وتطبيق الهوية فوراً</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
