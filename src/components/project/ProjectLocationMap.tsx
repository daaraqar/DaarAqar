"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { getMapTileConfig } from "@/lib/map/tileConfig";

interface ProjectLocationMapProps {
  lat: number;
  lng: number;
  currentLocation?: { lat: number; lng: number } | null;
  routeCoordinates?: [number, number][];
}

export default function ProjectLocationMap({
  lat,
  lng,
  currentLocation = null,
  routeCoordinates = [],
}: ProjectLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });
    const tileConfig = getMapTileConfig();

    L.tileLayer(tileConfig.tileUrl, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      ...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {}),
    }).addTo(map);

    const projectPin = L.divIcon({
      className: "project-location-marker",
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38" aria-hidden="true" focusable="false">
          <path d="M16 1C7.7 1 1 7.7 1 16c0 10.7 15 21 15 21s15-10.3 15-21C31 7.7 24.3 1 16 1Z" fill="#0f766e" stroke="#fff" stroke-width="2"/>
          <circle cx="16" cy="16" r="5" fill="#fff"/>
        </svg>
      `,
      iconSize: [32, 38],
      iconAnchor: [16, 37],
    });

    L.marker([lat, lng], {
      icon: projectPin,
      title: "موقع المشروع",
      alt: "دبوس موقع المشروع",
      keyboard: true,
    }).addTo(map);

    if (currentLocation) {
      L.circleMarker([currentLocation.lat, currentLocation.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip("موقعك الحالي")
        .addTo(map);
    }

    if (routeCoordinates.length > 1) {
      const routeLine = L.polyline(routeCoordinates, {
        color: "#0f766e",
        weight: 5,
        opacity: 0.9,
        lineJoin: "round",
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [28, 28], maxZoom: 15 });
    }

    return () => {
      map.remove();
    };
  }, [lat, lng, currentLocation, routeCoordinates]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full"
      role="application"
      aria-label={routeCoordinates.length > 1 ? "خريطة مسار التنقل إلى المشروع" : "خريطة موقع المشروع"}
    />
  );
}
