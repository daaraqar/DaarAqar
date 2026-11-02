"use client";

import React, { useState, useEffect } from "react";
import { Download, Share2, PlusSquare, X, Smartphone, Sparkles, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone app mode
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isRunningStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    if (isIosDevice) {
      setIsIos(true);
      // Show prompt banner after brief delay
      const timer = setTimeout(() => setDismissed(false), 2500);
      return () => clearTimeout(timer);
    }

    // 3. Android / Chromium native install prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (isStandalone || dismissed) return null;

  return (
    <>
      {/* Floating Smart Banner on Mobile */}
      <div className="fixed top-18 sm:top-20 right-3 left-3 sm:right-auto sm:left-4 z-40 max-w-sm animate-in slide-in-from-top-3 duration-300">
        <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white p-3.5 rounded-2xl border border-brand-500/30 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-400/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-brand-300 animate-bounce" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">تطبيق دار العقار</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-brand-500/30 text-brand-200 font-bold border border-brand-400/20">
                  {isIos ? "iOS / iPhone" : "Android"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-tight mt-0.5">
                ثبّت التطبيق على هاتفك لتصفح فوري أسرع بدون انتظار
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isIos ? (
              <button
                type="button"
                onClick={() => setShowIosGuide(true)}
                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-[11px] shadow-sm transition-all active:scale-95"
              >
                تثبيت الآن
              </button>
            ) : (
              <button
                type="button"
                onClick={handleInstallAndroid}
                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-[11px] shadow-sm transition-all active:scale-95 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تثبيت</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Step-by-Step Installation Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-5 text-right shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تثبيت التطبيق على آيفون</h3>
                  <p className="text-[10px] text-slate-500">يعمل بدون الحاجة لـ App Store</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-800 font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-900">اضغط على زر المشاركة (Share)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    أيقونة المربع بسهم لأعلى <Share2 className="w-3.5 h-3.5 text-blue-600 inline" /> في أسفل شاشة سفاري.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-800 font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-900">اختر "إضافة إلى الشاشة الرئيسية"</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    ابحث عن <PlusSquare className="w-3.5 h-3.5 text-brand-600 inline" /> (Add to Home Screen).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-800 font-black text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-900">اضغط "إضافة" (Add)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    سيظهر تطبيق "دار العقار" على شاشة هاتفك مثل التطبيقات الأصلية تماماً!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosGuide(false);
                handleDismiss();
              }}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-extrabold text-xs shadow-md hover:bg-brand-700 transition-colors"
            >
              فهمت ذلك، شكراً
            </button>
          </div>
        </div>
      )}
    </>
  );
}
