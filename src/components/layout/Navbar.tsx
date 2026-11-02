"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { User, UserRole, CmsNavLabels, VisualIdentitySettings } from "@/lib/db/types";
import { DEFAULT_BRAND_LOGO_PATH, DEFAULT_VISUAL_IDENTITY, getBrandLogoHeightPx } from "@/lib/brand-theme";
import {
  Compass,
  Building2,
  Home,
  PlusCircle,
  Sparkles,
  Heart,
  User as UserIcon,
  LogOut,
  Shield,
  Layers,
  ChevronDown,
  Menu,
  X,
  MapPin,
  ArrowRight,
  UserPlus,
  FileText,
  Phone,
  Info,
  ShieldCheck,
  MessageCircle,
  Crown,
} from "lucide-react";

interface NavbarProps {
  onOpenAddProperty?: () => void;
}

export default function Navbar({ onOpenAddProperty }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [propertiesMenuOpen, setPropertiesMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  // Dynamic Navbar labels from CMS
  const [navLabels, setNavLabels] = useState<CmsNavLabels>({
    brandTitle: "دار العقار",
    brandSubtitle: "Dar Al Aqar Egypt",
    home: "الرئيسية",
    propertiesDropdown: "العقارات",
    sale: "بيع",
    rent: "إيجار",
    explore: "الخريطة الذكية",
    smartMatch: "التوافق الذكي",
    about: "عن منصة دار العقار",
    contact: "اتصل بنا",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية وأمن البيانات",
    addProperty: "أضف عقارك",
  });
  const [visualIdentity, setVisualIdentity] = useState<VisualIdentitySettings>({
    ...DEFAULT_VISUAL_IDENTITY,
  });

  const userMenuRef = useRef<HTMLDivElement>(null);
  const propertiesMenuRef = useRef<HTMLDivElement>(null);

  const fetchUnreadMessages = useCallback(async (role?: UserRole) => {
    if (!role) {
      setUnreadMessagesCount(0);
      return;
    }

    try {
      // Admin sees platform-wide message count ONLY inside the admin panel.
      // Outside the panel, the admin is a regular user: personal conversations count only.
      const adminEverywhere = role === "admin" && pathname.startsWith("/admin");
      const mode = adminEverywhere ? "?mode=admin" : role === "admin" ? "?mode=seeker" : "";
      const res = await fetch(`/api/inquiries${mode}`, { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        setUnreadMessagesCount(0);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUnreadMessagesCount(typeof data.totalUnread === "number" ? data.totalUnread : 0);
      } else {
        console.warn("[Navbar] Failed to refresh unread message count:", res.status);
      }
    } catch (error) {
      console.warn("[Navbar] Could not refresh unread message count:", error);
    }
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    fetchCurrentUser();
    fetchNavLabels();
    setPropertiesMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    void fetchUnreadMessages(user?.role);
  }, [fetchUnreadMessages, pathname, user?.role]);

  useEffect(() => {
    const refreshUnreadMessages = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadMessages(user?.role);
      }
    };
    const handleAuthChange = () => {
      fetchCurrentUser();
      refreshUnreadMessages();
    };
    const intervalId = window.setInterval(refreshUnreadMessages, 15000);
    const handleCmsSettingsUpdated = () => {
      fetchNavLabels();
    };
    window.addEventListener("auth-state-changed", handleAuthChange);
    window.addEventListener("messages-read", refreshUnreadMessages);
    window.addEventListener("messages-updated", refreshUnreadMessages);
    window.addEventListener("focus", refreshUnreadMessages);
    document.addEventListener("visibilitychange", refreshUnreadMessages);
    window.addEventListener("cms-settings-updated", handleCmsSettingsUpdated);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("auth-state-changed", handleAuthChange);
      window.removeEventListener("messages-read", refreshUnreadMessages);
      window.removeEventListener("messages-updated", refreshUnreadMessages);
      window.removeEventListener("focus", refreshUnreadMessages);
      document.removeEventListener("visibilitychange", refreshUnreadMessages);
      window.removeEventListener("cms-settings-updated", handleCmsSettingsUpdated);
    };
  }, [fetchUnreadMessages, pathname, user?.role]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (propertiesMenuRef.current && !propertiesMenuRef.current.contains(e.target as Node)) {
        setPropertiesMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      setUser(data.user);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setUser(null);
    }
  };

  const fetchNavLabels = async () => {
    try {
      const res = await fetch("/api/cms/homepage");
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.navLabels) {
          setNavLabels((prev) => ({
            ...prev,
            ...data.settings.navLabels,
            brandTitle: data.settings.visualIdentity?.siteName || data.settings.navLabels.brandTitle,
            brandSubtitle: data.settings.visualIdentity?.siteSubtitle || data.settings.navLabels.brandSubtitle,
          }));
        }
        if (data.settings?.visualIdentity) {
          setVisualIdentity(data.settings.visualIdentity);
        }
      }
    } catch {
      // Keep existing
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setUserMenuOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth-state-changed"));
      }
      router.push("/");
      router.refresh();
    } catch {
      // Ignore
    } finally {
      setLoggingOut(false);
    }
  };

  const handleAddPropertyClick = () => {
    if (onOpenAddProperty) {
      onOpenAddProperty();
      return;
    }

    router.push("/dashboard/properties/new");
  };

  const isPropertiesActive =
    pathname.startsWith("/properties") ||
    pathname === "/explore";

  const BrandIcon = (() => {
    switch (visualIdentity?.logoIcon) {
      case "building": return Building2;
      case "sparkles": return Sparkles;
      case "compass": return Compass;
      case "shield": return Shield;
      case "crown": return Crown;
      case "layers": return Layers;
      case "home": return Home;
      default: return MapPin;
    }
  })();

  const headerBackgroundClass = visualIdentity?.headerBackground === "dark"
    ? "bg-secondary text-white border-secondary/80"
    : "bg-white border-slate-200";

  if (pathname === "/" || pathname.startsWith("/admin")) return null;

  return (
    <header className={`sticky top-0 z-50 border-b shadow-xs ${headerBackgroundClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex items-center justify-between py-2"
          style={{ minHeight: `${Math.max(64, getBrandLogoHeightPx(visualIdentity) + 16)}px` }}
        >
          {/* Brand Logo & Navigation */}
          <div className="flex items-center gap-4 lg:gap-6 xl:gap-8">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              {visualIdentity?.logoType === "image" ? (
                <NextImage
                  src={visualIdentity.logoImageUrl || DEFAULT_BRAND_LOGO_PATH}
                  alt={visualIdentity.siteName || navLabels.brandTitle || "دار العقار"}
                  width={144}
                  height={74}
                  unoptimized
                  style={{ height: `${getBrandLogoHeightPx(visualIdentity)}px`, width: "auto" }}
                  className="object-contain"
                />
              ) : visualIdentity?.logoType !== "text_only" ? (
                  <div
                    style={{ backgroundColor: visualIdentity?.primaryColor || undefined }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform ${
                      visualIdentity?.primaryColor ? "" : "bg-gradient-to-tr from-brand-800 to-brand-500 shadow-brand-700/20"
                    }`}
                  >
                    <BrandIcon className="w-5 h-5" style={{ color: visualIdentity?.iconColor || "#059669" }} />
                  </div>
                ) : null}
              {visualIdentity?.logoType !== "image" && (
                <div className="flex flex-col">
                  <span className={`text-xl font-black tracking-tight group-hover:text-brand-700 transition-colors ${visualIdentity?.headerBackground === "dark" ? "text-white" : "text-slate-900"}`}>
                    {visualIdentity?.siteName || navLabels.brandTitle || "دار العقار"}
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-accent -mt-1 uppercase">
                    {visualIdentity?.siteSubtitle || navLabels.brandSubtitle || "Dar Al Aqar Egypt"}
                  </span>
                </div>
              )}
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5">
              {/* الرئيسية */}
              <Link
                href="/"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  pathname === "/"
                    ? "bg-brand-50 text-brand-700 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>{navLabels.home || "الرئيسية"}</span>
              </Link>

              {/* قائمة العقارات المنسدلة: بيع، إيجار، الخريطة الذكية، التوافق الذكي */}
              <div className="relative" ref={propertiesMenuRef}>
                <button
                  type="button"
                  onClick={() => setPropertiesMenuOpen(!propertiesMenuOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isPropertiesActive || propertiesMenuOpen
                      ? "bg-brand-50 text-brand-700 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-brand-600" />
                  <span>{navLabels.propertiesDropdown || "العقارات"}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      propertiesMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {propertiesMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1 animate-in fade-in slide-in-from-top-1">
                    <Link
                      href="/properties?transactionType=sale"
                      onClick={() => setPropertiesMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 font-bold">{navLabels.sale || "بيع"}</span>
                        <span className="text-[10px] text-slate-400 font-medium">عقارات وفيلات للبيع</span>
                      </div>
                    </Link>

                    <Link
                      href="/properties?transactionType=rent"
                      onClick={() => setPropertiesMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 font-bold">{navLabels.rent || "إيجار"}</span>
                        <span className="text-[10px] text-slate-400 font-medium">شقق ووحدات للإيجار</span>
                      </div>
                    </Link>

                    <Link
                      href="/explore"
                      onClick={() => setPropertiesMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-slate-900 font-bold">{navLabels.explore || "الخريطة الذكية"}</span>
                        <span className="text-[10px] text-slate-400 font-medium">استكشاف جغرافي مباشر</span>
                      </div>
                    </Link>


                    <div className="border-t border-slate-150 my-1 pt-1">
                      <Link
                        href="/reels"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-rose-50 hover:text-rose-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                        <span>نبض ريلز (فيديو سريع)</span>
                      </Link>

                      <Link
                        href="/compounds"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>{navLabels.projects || "المشاريع العقارية"} (قريبًا)</span>
                      </Link>

                      <Link
                        href="/requests"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>سوق عقار مطلوب</span>
                      </Link>

                      <Link
                        href="/compare"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-brand-50 hover:text-brand-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"></span>
                        <span>مقارنة العقارات</span>
                      </Link>

                      <Link
                        href="/market-index"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                        <span>مؤشر السوق العقاري 2026</span>
                      </Link>

                      <Link
                        href="/neighborhoods"
                        onClick={() => setPropertiesMenuOpen(false)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-slate-700 hover:bg-teal-50 hover:text-teal-700 font-bold transition-colors text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>
                        <span>دليل الأحياء وجودة الحياة</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* صفحة عن منصة دار العقار */}
              <Link
                href="/about"
                className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  pathname === "/about"
                    ? "bg-brand-50 text-brand-700 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Info className="w-4 h-4 text-brand-600" />
                <span className="hidden xl:inline">{navLabels.about || "عن منصة دار العقار"}</span>
                <span className="xl:hidden">عن المنصة</span>
              </Link>

              {/* صفحة اتصل بنا */}
              <Link
                href="/contact"
                className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  pathname === "/contact"
                    ? "bg-brand-50 text-brand-700 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>{navLabels.contact || "اتصل بنا"}</span>
              </Link>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3" ref={userMenuRef}>
            {/* Favorites Icon (Desktop only) */}
            <Link
              href="/account/favorites"
              aria-label="العقارات المفضلة"
              aria-current={pathname === "/account/favorites" ? "page" : undefined}
              className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-slate-50 transition-colors relative"
              title="العقارات المفضلة"
            >
              <Heart className="w-5 h-5" />
            </Link>

            {/* Quick Inquiries / Chat with Notification Badge Pulse (إشعارات سريعة عبر شارة عائمة نابضة) */}
            {user && (
              <Link
                href={user.role === "admin" ? "/admin?tab=messages" : "/dashboard/inquiries"}
                className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-brand-700 hover:bg-slate-50 transition-colors relative"
                title="محادثات واستفسارات العقارات النشطة"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center animate-pulse ring-2 ring-white shadow-xs">
                    {unreadMessagesCount > 99 ? "+99" : unreadMessagesCount}
                  </span>
                )}
              </Link>
            )}

            {/* If Authenticated: User Account Menu (Desktop only - mobile uses dedicated bottom nav account sheet) */}
            {user ? (
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-700 text-white font-black text-xs flex items-center justify-center ring-2 ring-brand-500/20 shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="text-xs font-bold text-slate-900 block leading-tight max-w-[120px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      {getRoleNameAr(user.role)}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1">
                    {/* User Summary Header */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-sm truncate">{user.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block truncate">
                        {user.email}
                      </span>
                      <div className="pt-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-brand-100 text-brand-800 text-[10px] font-bold">
                          {getRoleNameAr(user.role)}
                        </span>
                      </div>
                    </div>

                    {/* Role-Specific Links */}
                    {user.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 p-2 rounded-xl text-amber-900 bg-amber-50 hover:bg-amber-100 font-bold transition-colors"
                      >
                        <Shield className="w-4 h-4 text-amber-700" />
                        <span>لوحة الإدارة والرقابة المركزية</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-brand-600" />
                      <span>
                        {user.role === "seeker" || user.role === "buyer"
                          ? "لوحة طلباتي واستفساراتي"
                          : "لوحة التحكم الرئيسية"}
                      </span>
                    </Link>

                    <Link
                      href="/dashboard/inquiries"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>المحادثات والرسائل الواردة</span>
                      </div>
                      {unreadMessagesCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                          {unreadMessagesCount}
                        </span>
                      )}
                    </Link>

                    {(user.role === "owner" || user.role === "broker" || user.role === "admin") && (
                      <>
                        <Link
                          href="/dashboard/properties"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                        >
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span>إدارة مشاريعي</span>
                        </Link>
                        <Link
                          href="/dashboard/properties/new"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 p-2 rounded-xl text-brand-700 hover:bg-brand-50 font-bold transition-colors"
                        >
                          <PlusCircle className="w-4 h-4 text-brand-600" />
                          <span>إضافة عقار جديد</span>
                        </Link>
                      </>
                    )}

                    <Link
                      href="/dashboard/portfolio"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 font-bold transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>محفظتي العقارية والأصول</span>
                    </Link>

                    <Link
                      href="/account/favorites"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>العقارات المفضلة</span>
                    </Link>

                    <Link
                      href="/account/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-brand-600" />
                      <span>الملف الشخصي والإعدادات</span>
                    </Link>

                    {/* Divider & Logout */}
                    <div className="pt-1 mt-1 border-t border-slate-100">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold transition-colors text-right"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 text-brand-600" />
                  <span>تسجيل الدخول</span>
                </Link>
              </div>
            )}

            {/* Add Property Button: Hidden on mobile (available in bottom nav) and hidden for Buyer/Seeker */}
            {(!user || (user.role !== "buyer" && user.role !== "seeker")) && (
              <button
                type="button"
                onClick={handleAddPropertyClick}
                className="hidden lg:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs shadow-md shadow-brand-600/20 active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{navLabels.addProperty || "أضف عقارك"}</span>
              </button>
            )}

            {/* Admin shortcut replaces the public navigation drawer on the admin panel */}
            <button
              type="button"
              onClick={() => {
                if (pathname.startsWith("/admin")) {
                  void handleLogout();
                } else {
                  setMobileMenuOpen(!mobileMenuOpen);
                }
              }}
              disabled={pathname.startsWith("/admin") && loggingOut}
              aria-label={pathname.startsWith("/admin") ? "تسجيل الخروج" : "فتح القائمة"}
              title={pathname.startsWith("/admin") ? "تسجيل الخروج" : "فتح القائمة"}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              {pathname.startsWith("/admin")
                ? <LogOut className={`w-5 h-5 ${loggingOut ? "animate-pulse" : ""}`} />
                : mobileMenuOpen
                  ? <X className="w-5 h-5" />
                  : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Strictly contains only the 5 platform navigation links) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1.5 py-1">
            {/* 1. الرئيسية */}
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all ${
                pathname === "/"
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Home className="w-4 h-4 text-brand-600 shrink-0" />
              <span>{navLabels.home || "الرئيسية"}</span>
            </Link>

            {/* 2. بيع */}
            <Link
              href="/properties?transactionType=sale"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-700 transition-all"
            >
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{navLabels.sale || "بيع"}</span>
            </Link>

            {/* 3. إيجار */}
            <Link
              href="/properties?transactionType=rent"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 transition-all"
            >
              <Layers className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{navLabels.rent || "إيجار"}</span>
            </Link>

            <Link
              href="/compounds"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700 transition-all"
            >
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{navLabels.projects || "المشاريع العقارية"} (قريبًا)</span>
            </Link>

            {/* 4. عن منصة دار العقار */}
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all ${
                pathname === "/about"
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-brand-50/50 hover:text-brand-700"
              }`}
            >
              <Info className="w-4 h-4 text-brand-600 shrink-0" />
              <span>{navLabels.about || "عن منصة دار العقار"}</span>
            </Link>

            {/* 5. اتصل بنا */}
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all ${
                pathname === "/contact"
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{navLabels.contact || "اتصل بنا"}</span>
            </Link>

            {/* Mobile Auth Actions for Guests */}
            {!user && (
              <div className="pt-3 border-t border-slate-150 grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-center font-black text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function getRoleNameAr(role: UserRole): string {
  switch (role) {
    case "admin":
      return "مدير النظام";
    case "broker":
      return "وسيط عقاري";
    case "owner":
      return "مالك عقار";
    case "seeker":
    case "buyer":
      return "عميل / باحث";
    default:
      return "زائر";
  }
}
