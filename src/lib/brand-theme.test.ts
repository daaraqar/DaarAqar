import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BRAND_LOGO_HEIGHT_PX,
  DEFAULT_VISUAL_IDENTITY,
  getBrandLogoHeightPx,
  getBrandThemeStyle,
} from "./brand-theme";

test("default brand identity uses the supplied Dar Al Aqar logo", () => {
  assert.equal(DEFAULT_VISUAL_IDENTITY.siteName, "دار العقار");
  assert.equal(DEFAULT_VISUAL_IDENTITY.logoImageUrl, "/branding/dar-al-aqar.png");
  assert.equal(DEFAULT_VISUAL_IDENTITY.logoType, "image");
  assert.equal(DEFAULT_VISUAL_IDENTITY.logoHeightPx, DEFAULT_BRAND_LOGO_HEIGHT_PX);
  assert.equal(DEFAULT_VISUAL_IDENTITY.headerBackground, "white");
});

test("brand logo height uses a stable configured value and safely defaults outside supported bounds", () => {
  assert.equal(getBrandLogoHeightPx({ ...DEFAULT_VISUAL_IDENTITY, logoHeightPx: 64 }), 64);
  assert.equal(getBrandLogoHeightPx({ ...DEFAULT_VISUAL_IDENTITY, logoHeightPx: 24 }), DEFAULT_BRAND_LOGO_HEIGHT_PX);
  assert.equal(getBrandLogoHeightPx({ ...DEFAULT_VISUAL_IDENTITY, logoHeightPx: 63.5 }), DEFAULT_BRAND_LOGO_HEIGHT_PX);
});

test("brand theme applies configured colors, font, heading weight, and radius", () => {
  const style = getBrandThemeStyle({
    ...DEFAULT_VISUAL_IDENTITY,
    primaryColor: "#123456",
    primaryHoverColor: "#654321",
    secondaryColor: "#abcdef",
    accentColor: "#fedcba",
    iconColor: "#112233",
    mapIconColor: "#445566",
    fontFamily: "tajawal",
    headingWeight: "extrabold",
    borderRadius: "rounded",
  });

  assert.equal(Reflect.get(style, "--brand-700"), "18 52 86");
  assert.equal(Reflect.get(style, "--brand-800"), "101 67 33");
  assert.equal(Reflect.get(style, "--brand-secondary"), "171 205 239");
  assert.equal(Reflect.get(style, "--brand-accent"), "254 220 186");
  assert.equal(Reflect.get(style, "--brand-icon-color"), "#112233");
  assert.equal(Reflect.get(style, "--brand-map-icon-color"), "#445566");
  assert.equal(Reflect.get(style, "--brand-map-icon-active-color"), "#654321");
  assert.equal(Reflect.get(style, "--brand-heading-weight"), "800");
  assert.equal(Reflect.get(style, "--font-cairo"), "'Tajawal', sans-serif");
  assert.equal(Reflect.get(style, "--radius-xl"), "22px");
});
