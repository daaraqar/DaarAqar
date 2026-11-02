"use client";

import React from "react";
import { MessageCircle, Phone } from "lucide-react";

interface MobilePropertyActionBarProps {
  phone?: string;
  whatsapp?: string;
}

export default function MobilePropertyActionBar({
  phone,
  whatsapp,
}: MobilePropertyActionBarProps) {
  const cleanPhone = phone?.replace(/[^0-9+]/g, "") ?? "";
  const cleanWa = (whatsapp || phone)?.replace(/[^0-9]/g, "") ?? "";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 pt-2 shadow-[0_-4px_15px_rgba(0,0,0,0.08)] backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom,16px))]">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        {cleanPhone ? (
          <a
            href={`tel:${cleanPhone}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-95"
          >
            <Phone className="h-4 w-4" />
            <span>اتصال</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-300 px-3 py-2.5 text-xs font-bold text-white"
          >
            <Phone className="h-4 w-4" />
            <span>اتصال</span>
          </button>
        )}

        {cleanWa ? (
          <a
            href={`https://wa.me/${cleanWa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
            <span>واتس اب</span>
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-300 px-3 py-2.5 text-xs font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            <span>واتس اب</span>
          </button>
        )}

        <a
          href="#direct-contact"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("direct-contact")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-brand-800 active:scale-95"
        >
          <MessageCircle className="h-4 w-4" />
          <span>تواصل مباشر</span>
        </a>
      </div>
    </div>
  );
}
