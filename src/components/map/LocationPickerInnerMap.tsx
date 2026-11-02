"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, Loader2 } from "lucide-react";

interface LocationPickerInnerMapProps {
  lat: number;
  lng: number;
  isApproximate?: boolean;
  onLocationChange: (lat: number, lng: number) => void;
  zoom?: number;
}

// Same reliable tile source used by the homepage map (LeafletInnerMap)
const clearTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const clearAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function LocationPickerInnerMap({
  lat,
  lng,
  isApproximate = false,
  onLocationChange,
  zoom = 13,
}: LocationPickerInnerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: false,
      maxZoom: 19,
    });

    L.tileLayer(clearTileUrl, {
      attribution: clearAttribution,
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    // Custom Draggable Pin
    const customIcon = L.divIcon({
      className: "location-picker-pin",
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: grab;">
          <div style="background: #0f766e; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 2px;">
            📍 موقع العقار
          </div>
          <div style="width: 14px; height: 14px; background: #0f766e; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [80, 42],
      iconAnchor: [40, 42],
    });

    const marker = L.marker([lat, lng], {
      icon: customIcon,
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      // Use the exact drag-end position, not a rounded one
      onLocationChangeRef.current(pos.lat, pos.lng);
    });

    // Map click moves pin — use event's exact coordinates
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    // Privacy circle
    const circle = L.circle([lat, lng], {
      radius: 500,
      color: "#d97706",
      fillColor: "#f59e0b",
      fillOpacity: isApproximate ? 0.2 : 0,
      weight: isApproximate ? 1.5 : 0,
      dashArray: "4, 6",
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pin position when lat/lng props change from outside
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 0.000001 || Math.abs(current.lng - lng) > 0.000001) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng], { animate: true });
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      if (isApproximate) {
        circleRef.current.setStyle({
          weight: 1.5,
          fillOpacity: 0.2,
        });
      } else {
        circleRef.current.setStyle({
          weight: 0,
          fillOpacity: 0,
        });
      }
    }
  }, [lat, lng, isApproximate]);

  // Use device's current location with high accuracy
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("المتصفح لا يدعم تحديد الموقع الجغرافي");
      return;
    }
    setLocateError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat2 = position.coords.latitude;
        const lng2 = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setLocating(false);

        if (markerRef.current && mapRef.current) {
          markerRef.current.setLatLng([lat2, lng2]);
          mapRef.current.setView([lat2, lng2], Math.max(16, mapRef.current.getZoom()), { animate: true });
          onLocationChangeRef.current(lat2, lng2);
        }

        // Show a temporary accuracy circle around the fixed point
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }
        if (mapRef.current && typeof accuracy === "number" && accuracy > 0) {
          accuracyCircleRef.current = L.circle([lat2, lng2], {
            radius: Math.min(accuracy, 200),
            color: "#0f766e",
            fillColor: "#14b8a6",
            fillOpacity: 0.12,
            weight: 1,
          }).addTo(mapRef.current);
          setTimeout(() => {
            if (accuracyCircleRef.current) {
              accuracyCircleRef.current.remove();
              accuracyCircleRef.current = null;
            }
          }, 8000);
        }
      },
      (error) => {
        setLocating(false);
        const messages: Record<number, string> = {
          1: "تم رفض الإذن للوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح.",
          2: "تعذر تحديد الموقع الحالي. تأكد من تشغيل خدمة الموقع على جهازك.",
          3: "انتهت مهلة تحديد الموقع. حاول مرة أخرى.",
        };
        setLocateError(messages[error.code] || "تعذر تحديد الموقع الحالي");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-slate-200">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm pointer-events-none">
        💡 انقر على الخريطة أو اسحب الدبوس لتحديد الموقع بدقة
      </div>
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={locating}
        className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-md text-xs font-bold text-slate-800 transition disabled:opacity-60"
        title="استخدم موقعي الحالي"
      >
        {locating ? (
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
        ) : (
          <LocateFixed className="w-4 h-4 text-brand-600" />
        )}
        <span>{locating ? "جاري تحديد موقعك..." : "موقعي الحالي"}</span>
      </button>
      {locateError && (
        <div className="absolute bottom-16 left-3 z-[1000] max-w-[240px] bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold px-3 py-2 rounded-xl shadow-md">
          {locateError}
        </div>
      )}
    </div>
  );
}
