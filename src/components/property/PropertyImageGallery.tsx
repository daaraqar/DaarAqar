"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from "lucide-react";

interface PropertyImageGalleryProps {
  images: string[];
  title: string;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80";

export default function PropertyImageGallery({ images, title }: PropertyImageGalleryProps) {
  const galleryImages = images.filter((image) => image.trim().length > 0);
  const displayImages = galleryImages.length > 0 ? galleryImages : [FALLBACK_IMAGE];
  const thumbnails = galleryImages.slice(1, 3);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const showPrevious = useCallback(() => {
    setActiveIndex((index) => (index - 1 + displayImages.length) % displayImages.length);
  }, [displayImages.length]);
  const showNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % displayImages.length);
  }, [displayImages.length]);
  const openGallery = (index: number) => {
    setActiveIndex(index);
    setIsGalleryOpen(true);
  };

  useEffect(() => {
    if (!isGalleryOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGalleryOpen(false);
      if (event.key === "ArrowLeft") showNext();
      if (event.key === "ArrowRight") showPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGalleryOpen, showNext, showPrevious]);

  return (
    <>
      <section className="space-y-2" aria-label="صور العقار" dir="rtl">
        <div
          className={`${
            thumbnails.length > 0
              ? "grid grid-cols-2 gap-2 md:h-[28rem] md:grid-cols-3 md:grid-rows-2 lg:h-[32rem]"
              : ""
          }`}
        >
          <button
            type="button"
            onClick={() => openGallery(0)}
            aria-label={`فتح صور ${title}`}
            className={`group relative block w-full overflow-hidden rounded-2xl bg-slate-100 text-right ${
              thumbnails.length > 0
                ? "col-span-2 aspect-[16/10] md:row-span-2 md:aspect-auto md:h-full"
                : "aspect-[16/10] md:aspect-[16/7]"
            }`}
          >
            <Image
              src={displayImages[0]}
              alt={`${title} - صورة 1`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 66vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {galleryImages.length > 1 && (
              <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-bold text-white">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {galleryImages.length} صور
                </span>
              </span>
            )}
          </button>

          {thumbnails.map((image, thumbnailIndex) => {
            const imageIndex = thumbnailIndex + 1;
            const isLastThumbnail = thumbnailIndex === thumbnails.length - 1;

            return (
              <button
                key={`${image}-${imageIndex}`}
                type="button"
                onClick={() => openGallery(imageIndex)}
                aria-label={
                  isLastThumbnail
                    ? `رؤية المزيد من الصور، الصورة ${imageIndex + 1}`
                    : `عرض الصورة ${imageIndex + 1}`
                }
                className={`group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100 text-right md:aspect-auto md:min-h-0 ${
                  thumbnails.length === 1 ? "md:row-span-2 md:h-full" : ""
                }`}
              >
                <Image
                  src={image}
                  alt={`${title} - صورة ${imageIndex + 1}`}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {isLastThumbnail && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/55 px-2 text-center text-xs font-black text-white transition-colors group-hover:bg-slate-950/65">
                    <ImageIcon className="h-5 w-5" />
                    <span>رؤية المزيد من الصور</span>
                    {galleryImages.length > 3 && (
                      <span className="text-[10px] font-bold text-white/85">
                        +{galleryImages.length - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {isGalleryOpen && galleryImages.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`صور ${title}`}
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 text-white backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4" dir="rtl">
            <div className="flex min-w-0 items-center gap-2">
              <ImageIcon className="h-5 w-5 shrink-0 text-emerald-400" />
              <span className="truncate text-sm font-black">{title}</span>
              <span className="shrink-0 text-xs font-medium text-white/60">
                ({activeIndex + 1} من {galleryImages.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsGalleryOpen(false)}
              aria-label="إغلاق معرض الصور"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-4"
            onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
            onTouchEnd={(event) => {
              if (touchStartX === null) return;
              const deltaX = event.changedTouches[0].clientX - touchStartX;
              if (Math.abs(deltaX) > 45) {
                if (deltaX > 0) showPrevious();
                else showNext();
              }
              setTouchStartX(null);
            }}
          >
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="الصورة السابقة"
                  className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 sm:right-6 sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label="الصورة التالية"
                  className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 sm:left-6 sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              </>
            )}
            <div className="relative h-full w-full max-w-6xl">
              <Image
                src={galleryImages[activeIndex]}
                alt={`${title} - صورة ${activeIndex + 1}`}
                fill
                unoptimized
                sizes="100vw"
                className="select-none object-contain"
              />
            </div>
          </div>

          {galleryImages.length > 1 && (
            <div className="flex items-center justify-start gap-2 overflow-x-auto border-t border-white/10 bg-black/40 p-3 no-scrollbar">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`عرض الصورة ${index + 1}`}
                  aria-pressed={activeIndex === index}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-16 ${
                    index === activeIndex
                      ? "scale-105 border-emerald-400"
                      : "border-transparent opacity-65 hover:opacity-100"
                  }`}
                >
                  <span className="relative block h-full w-full">
                    <Image src={image} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
