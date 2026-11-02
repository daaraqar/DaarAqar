"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { PublicProperty } from "@/lib/db/types";
import Link from "next/link";
import { Eye, MapPin, Bed, Bath, Maximize2, ShieldCheck, CheckCircle } from "lucide-react";
import { isPropertyOwnedByUser } from "@/lib/utils/propertyOwnership";
import { APPROXIMATE_LOCATION_RADIUS_METERS } from "@/lib/db/types";

interface LeafletInnerMapProps {
  properties: PublicProperty[];
  viewerId?: string | null;
  viewerLoaded?: boolean;
  selectedPropertyId?: string | null;
  onSelectProperty?: (property: PublicProperty | null) => void;
  onDirectContact?: (property: PublicProperty) => void;
  showMarkerPopups?: boolean;
  onBoundsChange?: (bounds: {
    southWest: { lat: number; lng: number };
    northEast: { lat: number; lng: number };
  }) => void;
  center?: [number, number];
  zoom?: number;
  autoFitKey?: string | number;
  searchLocation?: { lat: number; lng: number; label: string } | null;
  userLocation?: { lat: number; lng: number } | null;
  mapType?: "satellite" | "street";
}

interface ReputationBadge {
  sellerHighlyRated: boolean;
  projectTrending: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  favoritesCount: number;
}

function getPropertyCoords(p: any): [number, number] | null {
  if (!p) return null;
  const lat = Number(p.latitude ?? (p.location?.coordinates ? p.location.coordinates[1] : (p.lat ?? p.exact_lat)));
  const lng = Number(p.longitude ?? (p.location?.coordinates ? p.location.coordinates[0] : (p.lng ?? p.exact_lng)));
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

// استخدام خريطة OpenStreetMap القياسية ذات الألوان الواضحة والزاهية
const clearTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const clearAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function LeafletInnerMap({
  properties,
  viewerId,
  viewerLoaded = false,
  selectedPropertyId,
  onSelectProperty,
  onDirectContact,
  showMarkerPopups = true,
  onBoundsChange,
  center = [30.7194, 31.2580], // Meet Ghamr center default
  zoom = 13,
  autoFitKey,
  searchLocation,
  userLocation,
  mapType = "street",
}: LeafletInnerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);
  
  const markersMapRef = useRef(new Map<string, L.Marker>());

  const isProgrammaticMoveRef = useRef<boolean>(false);
  const prevFitKeyRef = useRef<string | number | undefined>(undefined);
  const prevPropertiesCountRef = useRef<number>(-1);
  const onSelectPropertyRef = useRef(onSelectProperty);
  const onDirectContactRef = useRef(onDirectContact);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const [reputationBadges, setReputationBadges] = useState<Record<string, ReputationBadge>>({});
  const propertyIds = properties.map((property) => property.id).filter(Boolean);
  const propertyIdsKey = propertyIds.join(",");

  useEffect(() => {
    onSelectPropertyRef.current = onSelectProperty;
    onDirectContactRef.current = onDirectContact;
    onBoundsChangeRef.current = onBoundsChange;
  }, [onSelectProperty, onDirectContact, onBoundsChange]);

  useEffect(() => {
    const controller = new AbortController();
    const ids = propertyIdsKey
      .split(",")
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (ids.length === 0) {
      setReputationBadges({});
      return () => controller.abort();
    }

    const loadBadges = async () => {
      try {
        const badgeEntries = await Promise.all(
          Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => {
            const chunk = ids.slice(index * 100, (index + 1) * 100);
            return fetch(`/api/ratings/map?ids=${encodeURIComponent(chunk.join(","))}`, {
              cache: "no-store",
              signal: controller.signal,
            }).then(async (response) => {
              const result = await response.json();
              if (!response.ok || !result.success) {
                throw new Error(result.error || "تعذر تحميل شارات التقييم للخريطة");
              }
              return result.badges as Record<string, ReputationBadge>;
            });
          })
        );
        if (!controller.signal.aborted) {
          setReputationBadges(Object.assign({}, ...badgeEntries));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[LeafletInnerMap] Failed to load map reputation badges:", error);
        }
      }
    };

    void loadBadges();
    return () => controller.abort();
  }, [propertyIdsKey]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      maxZoom: 19,
    });

    const isSatellite = mapType === "satellite";
    const tileLayer = isSatellite
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Esri World Imagery",
          maxZoom: 19,
        })
      : L.tileLayer(clearTileUrl, {
          attribution: clearAttribution,
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    const markersLayer = L.layerGroup().addTo(map);
    const circlesLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    circlesLayerRef.current = circlesLayer;
    mapInstanceRef.current = map;

    let debounceTimer: NodeJS.Timeout;
    map.on("moveend zoomend", () => {
      if (isProgrammaticMoveRef.current) {
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!onBoundsChangeRef.current) return;
        const b = map.getBounds();
        onBoundsChangeRef.current({
          southWest: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
          northEast: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
        });
      }, 400);
    });

    const resizeHandler = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", resizeHandler);
    setTimeout(resizeHandler, 150);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic Tile Layer Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const isSatellite = mapType === "satellite";
    const newTileLayer = isSatellite
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Esri World Imagery",
          maxZoom: 19,
        })
      : L.tileLayer(clearTileUrl, {
          attribution: clearAttribution,
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        });
    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [mapType]);

  // Update Markers and bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const circlesLayer = circlesLayerRef.current;
    if (!map || !markersLayer || !circlesLayer) return;

    markersLayer.clearLayers();
    circlesLayer.clearLayers();
    markersMapRef.current.clear();

    properties.forEach((prop) => {
      const coords = getPropertyCoords(prop);
      if (!coords) return;
      const [propLat, propLng] = coords;

      const isSelected = selectedPropertyId === prop.id;

      let formattedPrice = "";
      if (prop.price >= 1000000) {
        const millions = prop.price / 1000000;
        formattedPrice = (millions % 1 === 0 ? millions.toString() : millions.toFixed(1)) + " مليون";
      } else if (prop.price >= 1000) {
        formattedPrice = Math.round(prop.price / 1000) + " ألف";
      } else {
        formattedPrice = prop.price.toString();
      }
      const reputation = reputationBadges[prop.id];
      const reputationLabels = [
        reputation?.sellerHighlyRated
          ? '<span class="map-reputation-badge seller">★ بائع عالي التقييم</span>'
          : "",
        reputation?.projectTrending
          ? '<span class="map-reputation-badge project">🔥 مشروع رائج</span>'
          : "",
      ].join("");

      const iconHtml = `
        <div class="modern-price-pin ${isSelected ? "active" : ""}">
          ${reputationLabels ? `<div class="map-reputation-badges">${reputationLabels}</div>` : ""}
          <div class="pill-badge">
            <span>${formattedPrice}</span>
          </div>
          <div class="pin-tip"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-leaflet-pin-wrapper",
        html: iconHtml,
        iconSize: [reputationLabels ? 140 : 72, reputationLabels ? 52 : 32],
        iconAnchor: [reputationLabels ? 70 : 36, reputationLabels ? 51 : 31],
      });

      const marker = L.marker([propLat, propLng], { icon: customIcon });
      markersMapRef.current.set(prop.id, marker);

      if (prop.isApproximateLocation) {
        const circle = L.circle([propLat, propLng], {
          radius: prop.privacyRadiusMeters || APPROXIMATE_LOCATION_RADIUS_METERS,
          color: isSelected ? "#d97706" : "#0d9488",
          fillColor: isSelected ? "#f59e0b" : "#14b8a6",
          fillOpacity: 0.18,
          weight: 1.5,
          dashArray: "4, 6",
        });
        circle.addTo(circlesLayer);
      }

      if (showMarkerPopups) {
        const showContactButton =
          viewerId === undefined ||
          (viewerLoaded && !isPropertyOwnedByUser(prop, viewerId));
        const popupHtml = `
        <div style="width: 250px; font-family: var(--font-cairo, 'Cairo', sans-serif);">
          <div style="position: relative; height: 72px; width: 100%; margin: 0 auto 6px; border-radius: 8px; overflow: hidden; background: #e2e8f0;">
            <img src="${prop.images[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80'}" 
                 alt="${prop.title}" 
                 style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
            <div style="position: absolute; top: 6px; right: 6px; background: rgba(15, 23, 42, 0.85); color: white; padding: 1.5px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold;">
              ${prop.transactionType === "sale" ? "للبيع" : "للإيجار"}
            </div>
            ${prop.isApproximateLocation ? `
              <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(217, 119, 6, 0.9); color: white; padding: 1.5px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 600;">
                موقع تقريبي (نطاق ${APPROXIMATE_LOCATION_RADIUS_METERS}م)
              </div>
            ` : ""}
          </div>
          <div style="padding: 10px 12px 12px 12px;">
            <div style="font-weight: 800; font-size: 14px; color: #0f766e; margin-bottom: 2px;">
              ${prop.price.toLocaleString("ar-EG")} ج.م ${prop.rentalPeriod ? "/ شهر" : ""}
            </div>
            <div style="font-weight: 700; font-size: 12.5px; color: #1e293b; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${prop.title}
            </div>
            <div style="display: flex; gap: 10px; font-size: 11px; color: #64748b; margin-bottom: 10px; border-top: 1px solid #f1f5f9; padding-top: 5px;">
              <span><strong>${prop.areaSqM}</strong> م²</span>
              ${prop.bedrooms ? `<span><strong>${prop.bedrooms}</strong> غرف</span>` : ""}
              ${prop.bathrooms ? `<span><strong>${prop.bathrooms}</strong> حمام</span>` : ""}
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="/properties/${prop.slug}" 
                 style="flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; background: #0f766e; color: white; text-decoration: none; padding: 6.5px 8px; border-radius: 8px; font-size: 11px; font-weight: 800; transition: background 0.2s; white-space: nowrap;">
                عرض التفاصيل
              </a>
              ${showContactButton ? `<a href="/properties/${prop.slug}#direct-contact"
                 class="js-direct-contact-btn"
                 style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; text-align: center; background: #0f172a; color: white; text-decoration: none; padding: 6.5px 8px; border-radius: 8px; font-size: 11px; font-weight: 800; transition: background 0.2s; white-space: nowrap; cursor: pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                <span>التواصل المباشر</span>
              </a>` : ""}
            </div>
          </div>
        </div>
      `;

        marker.bindPopup(popupHtml, { maxWidth: 280 });

        marker.on("popupopen", (e) => {
          const popupEl = e.popup.getElement();
          if (!popupEl) return;
          const contactBtn = popupEl.querySelector(".js-direct-contact-btn");
          if (contactBtn) {
            contactBtn.addEventListener("click", (ev) => {
              if (onDirectContactRef.current) {
                ev.preventDefault();
                ev.stopPropagation();
                onDirectContactRef.current(prop);
              }
            });
          }
        });
      }

      marker.on("click", () => {
        if (onSelectPropertyRef.current) onSelectPropertyRef.current(prop);
      });

      marker.addTo(markersLayer);

      if (isSelected && showMarkerPopups) {
        marker.openPopup();
      }
    });

    if (searchLocation) {
      const searchIcon = L.divIcon({
        className: "search-location-marker",
        html: '<div style="width:28px;height:28px;border:4px solid #fff;border-radius:50%;background:#f97316;box-shadow:0 2px 10px #0f172a80"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const searchMarker = L.marker([searchLocation.lat, searchLocation.lng], {
        icon: searchIcon,
        zIndexOffset: 2500,
      });
      const popup = document.createElement("div");
      popup.textContent = searchLocation.label;
      searchMarker.bindPopup(popup).addTo(markersLayer);
    }

    if (userLocation && typeof userLocation.lat === "number" && typeof userLocation.lng === "number") {
      const userHtml = `
        <div style="position: relative; width: 22px; height: 22px;">
          <div style="position: absolute; width: 44px; height: 44px; background: rgba(37, 99, 235, 0.25); border-radius: 50%; top: -11px; left: -11px; animation: markerPulse 2s infinite ease-out;"></div>
          <div style="position: absolute; width: 18px; height: 18px; background: #2563eb; border: 3px solid white; border-radius: 50%; top: 2px; left: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
        </div>
      `;
      const userMarkerIcon = L.divIcon({
        className: "user-radar-marker",
        html: userHtml,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const uMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userMarkerIcon,
        zIndexOffset: 3000,
      });
      uMarker.bindPopup('<div style="font-family: Cairo, sans-serif; padding: 6px 10px; font-weight: bold; font-size: 13px; color: #1e3a8a; text-align: center;">📍 موقعك الحالي</div>');
      uMarker.addTo(markersLayer);
    }

    const shouldAutoFit =
      (autoFitKey !== undefined && autoFitKey !== prevFitKeyRef.current) ||
      (properties.length !== prevPropertiesCountRef.current && properties.length > 0);

    if (shouldAutoFit) {
      prevFitKeyRef.current = autoFitKey;
      prevPropertiesCountRef.current = properties.length;

      const validLatLngs = properties
        .map(getPropertyCoords)
        .filter((c): c is [number, number] => c !== null);

      if (userLocation) {
        isProgrammaticMoveRef.current = true;
        map.flyTo([userLocation.lat, userLocation.lng], Math.max(zoom || 14, 15), {
          duration: 1.2,
        });
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 1300);
      } else if (searchLocation) {
        isProgrammaticMoveRef.current = true;
        map.flyTo(
          [searchLocation.lat, searchLocation.lng],
          Math.max(map.getZoom(), 16),
          { duration: 1.2 }
        );
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 1300);
      } else if (validLatLngs.length === 1) {
        isProgrammaticMoveRef.current = true;
        map.flyTo(validLatLngs[0], Math.max(map.getZoom(), 15), {
          duration: 1.2,
        });

        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 1300);
      } else if (validLatLngs.length > 1) {
        const bounds = L.latLngBounds(validLatLngs);
        if (bounds.isValid()) {
          isProgrammaticMoveRef.current = true;
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
            animate: true,
          });

          setTimeout(() => {
            isProgrammaticMoveRef.current = false;
          }, 1000);
        }
      } else if (center) {
        isProgrammaticMoveRef.current = true;
        map.flyTo(center, zoom || 13, { duration: 1.2 });
        setTimeout(() => {
          isProgrammaticMoveRef.current = false;
        }, 1300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, viewerId, viewerLoaded, selectedPropertyId, showMarkerPopups, autoFitKey, center, zoom, searchLocation, userLocation, reputationBadges]);

  useEffect(() => {
    if (!selectedPropertyId || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const marker = markersMapRef.current.get(selectedPropertyId);
    const prop = properties.find((p) => p.id === selectedPropertyId);

    if (prop) {
      const coords = getPropertyCoords(prop);
      if (!coords) return;

      isProgrammaticMoveRef.current = true;
      map.panTo(coords, { animate: true });
      if (marker && showMarkerPopups) {
        marker.openPopup();
      }
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 500);
    }
  }, [selectedPropertyId, properties, showMarkerPopups]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
