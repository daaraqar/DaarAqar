/**
 * AqarPulse Platform — Geospatial Map & Tile Layer Configuration
 *
 * Centralized tile layer provider for Leaflet maps across the application:
 * - /explore (Interactive public search map)
 * - /properties/[slug] (Property details location map)
 * - /dashboard/properties/new (Property location picker map)
 *
 * Supports CARTO Voyager raster tiles with authenticated API key,
 * and seamlessly provides a graceful fallback to OpenStreetMap if the key is absent.
 */

export interface MapTileConfig {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
  hasApiKey: boolean;
  provider: "carto_voyager" | "openstreetmap_fallback";
}

export function getMapTileConfig(): MapTileConfig {
  // Check client-side Next.js public key first, then generic fallback
  const apiKey = (
    process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY ||
    process.env.CARTO_BASEMAPS_API_KEY ||
    ""
  ).trim();

  // If a valid key is present (and not an empty or example placeholder)
  if (apiKey && apiKey !== "your_carto_basemaps_api_key_here") {
    return {
      // Leaflet expects {z}, {x}, {y} placeholders. Key is appended via query parameter.
      tileUrl: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
      maxZoom: 19,
      hasApiKey: true,
      provider: "carto_voyager",
    };
  }

  // Graceful fallback: If no API key is configured, use OpenStreetMap standard tiles
  // so the map never fails, never throws 401/403, and never displays the "API key required" watermark!
  return {
    tileUrl: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    maxZoom: 19,
    subdomains: "abcd",
    hasApiKey: false,
    provider: "openstreetmap_fallback",
  };
}
