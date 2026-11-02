"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MapPin, Loader2 } from "lucide-react";

interface LocationPickerMapProps {
  lat: number;
  lng: number;
  isApproximate?: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  zoom?: number;
}

const DynamicLocationPicker = dynamic(() => import("./LocationPickerInnerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] rounded-xl bg-slate-100 flex flex-col items-center justify-center border border-slate-200">
      <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
      <span className="text-xs font-semibold text-slate-600">جاري تحميل خريطة تحديد الموقع...</span>
    </div>
  ),
});

export default function LocationPickerMap(props: LocationPickerMapProps) {
  return <DynamicLocationPicker {...props} />;
}
