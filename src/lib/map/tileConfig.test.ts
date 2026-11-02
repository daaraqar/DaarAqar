import test from "node:test";
import assert from "node:assert/strict";
import { getMapTileConfig } from "./tileConfig";

test("Map Tile Config: Falls back gracefully to OpenStreetMap when no CARTO API key is present", () => {
  const originalPublic = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
  const originalServer = process.env.CARTO_BASEMAPS_API_KEY;

  delete process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
  delete process.env.CARTO_BASEMAPS_API_KEY;

  try {
    const config = getMapTileConfig();
    assert.equal(config.hasApiKey, false);
    assert.equal(config.provider, "openstreetmap_fallback");
    assert.ok(config.tileUrl.includes("basemaps.cartocdn.com") || config.tileUrl.includes("tile.openstreetmap.org"));
    assert.ok(config.tileUrl.includes("{z}/{x}/{y}"));
    assert.ok(config.attribution.includes("OpenStreetMap"));
  } finally {
    if (originalPublic) process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY = originalPublic;
    if (originalServer) process.env.CARTO_BASEMAPS_API_KEY = originalServer;
  }
});

test("Map Tile Config: Generates authenticated CARTO Voyager URL when API key is set", () => {
  const originalPublic = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
  process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY = "test_carto_secret_token_12345";

  try {
    const config = getMapTileConfig();
    assert.equal(config.hasApiKey, true);
    assert.equal(config.provider, "carto_voyager");
    assert.ok(config.tileUrl.includes("basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"));
    assert.ok(config.tileUrl.includes("key=test_carto_secret_token_12345"));
    assert.ok(config.attribution.includes("CARTO"));
    assert.ok(config.attribution.includes("OpenStreetMap"));
  } finally {
    if (originalPublic) {
      process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY = originalPublic;
    } else {
      delete process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
    }
  }
});

test("Map Tile Config: Ignores placeholder values and falls back safely", () => {
  const originalPublic = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
  process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY = "your_carto_basemaps_api_key_here";

  try {
    const config = getMapTileConfig();
    assert.equal(config.hasApiKey, false);
    assert.equal(config.provider, "openstreetmap_fallback");
  } finally {
    if (originalPublic) {
      process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY = originalPublic;
    } else {
      delete process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY;
    }
  }
});
