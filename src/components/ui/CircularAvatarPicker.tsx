"use client";

import React, { useRef, useState } from "react";
import { Camera, User as UserIcon, X, Upload, Sparkles, Check } from "lucide-react";

export const PRESET_AVATARS = [
  {
    id: "man-1",
    label: "شاب",
    url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80",
  },
  {
    id: "woman-1",
    label: "سيدة",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80",
  },
  {
    id: "man-2",
    label: "مستشار",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80",
  },
  {
    id: "woman-2",
    label: "مهندسة",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80",
  },
  {
    id: "man-3",
    label: "وسيط عقاري",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80",
  },
  {
    id: "woman-3",
    label: "مديرة عقارات",
    url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80",
  },
];

interface CircularAvatarPickerProps {
  value?: string;
  onChange: (url: string) => void;
  userName?: string;
  label?: string;
}

export default function CircularAvatarPicker({
  value,
  onChange,
  userName = "مستخدم",
  label = "الصورة الشخصية للحساب",
}: CircularAvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP)");
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize smoothly to a crisp 250x250 square canvas
        const canvas = document.createElement("canvas");
        const size = 250;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Calculate center-crop dimensions
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          onChange(dataUrl);
        }
        setIsProcessing(false);
      };
      img.onerror = () => setIsProcessing(false);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block font-bold text-xs text-slate-700">{label}</label>
        <span className="text-[10px] text-slate-400 font-medium">دائرية رسمية للملف الشخصي</span>
      </div>

      <div className="flex items-center gap-4 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/90">
        {/* Main Circular Avatar Preview */}
        <div className="relative shrink-0">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-brand-700 to-brand-500 text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-white ring-4 ring-brand-500/20 cursor-pointer group relative transition-transform active:scale-95 hover:ring-brand-500/40"
            title="انقر لرفع صورة شخصية"
          >
            {value ? (
              <img
                src={value}
                alt={userName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span>{userName.charAt(0) || "U"}</span>
            )}

            {/* Hover overlay with camera icon */}
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Camera Badge in bottom corner */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md border-2 border-white hover:bg-brand-700 transition-colors"
            title="تغيير الصورة"
          >
            <Camera className="w-3 h-3" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Action Controls */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-brand-600" />
              <span>{value ? "تغيير الصورة" : "رفع من جهازك"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="py-1.5 px-2.5 rounded-xl bg-brand-50 text-brand-800 text-xs font-bold hover:bg-brand-100 flex items-center gap-1 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>أفاتار مقترح</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="py-1.5 px-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
                title="إزالة الصورة"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            ستظهر صورتك الشخصية بشكل دائري في جميع المعاملات، المحادثات، وبطاقة الحساب.
          </p>
        </div>
      </div>

      {/* Preset Avatars Drawer */}
      {showPresets && (
        <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2 animate-in fade-in">
          <span className="text-[11px] font-bold text-slate-500 block">
            اختر صورة دائرية جاهزة بنقرة واحدة:
          </span>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_AVATARS.map((preset) => {
              const isSelected = value === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onChange(preset.url);
                    setShowPresets(false);
                  }}
                  className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all active:scale-95 group ${
                    isSelected
                      ? "ring-2 ring-brand-600 border-white scale-105"
                      : "border-slate-200 hover:border-brand-400"
                  }`}
                  title={preset.label}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    className="w-full h-full object-cover rounded-full"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-brand-600/40 flex items-center justify-center rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
