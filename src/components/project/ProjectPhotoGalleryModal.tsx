"use client";

import React, { useState } from "react";
import { X, ChevronRight, ChevronLeft, Image as ImageIcon } from "lucide-react";

interface ProjectPhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  projectTitle: string;
}

export default function ProjectPhotoGalleryModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  projectTitle,
}: ProjectPhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!isOpen || !images.length) return null;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between text-white border-b border-white/10" dir="rtl">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-black truncate max-w-xs">{projectTitle}</span>
          <span className="text-xs text-white/60 font-medium">
            ({currentIndex + 1} من {images.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Next / Prev Navigation */}
        <button
          onClick={prevImage}
          className="absolute right-4 z-10 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <button
          onClick={nextImage}
          className="absolute left-4 z-10 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[currentIndex]}
          alt={`${projectTitle} - صورة ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl select-none"
        />
      </div>

      {/* Thumbnails strip */}
      <div className="p-3 bg-black/40 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar justify-center">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
              idx === currentIndex ? "border-emerald-400 scale-105" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="صورة مصغرة" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
