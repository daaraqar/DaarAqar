import type { CSSProperties } from "react";
import type { VisualIdentitySettings } from "./db/types";

export const DEFAULT_BRAND_LOGO_PATH = "/branding/dar-al-aqar.png";
export const DEFAULT_BRAND_LOGO_HEIGHT_PX = 48;
export const MIN_BRAND_LOGO_HEIGHT_PX = 32;
export const MAX_BRAND_LOGO_HEIGHT_PX = 80;

export function getBrandLogoHeightPx(identity?: Partial<VisualIdentitySettings>): number {
  const height = identity?.logoHeightPx;
  return typeof height === "number" &&
    Number.isInteger(height) &&
    height >= MIN_BRAND_LOGO_HEIGHT_PX &&
    height <= MAX_BRAND_LOGO_HEIGHT_PX
    ? height
    : DEFAULT_BRAND_LOGO_HEIGHT_PX;
}

export const DEFAULT_VISUAL_IDENTITY: VisualIdentitySettings = {
  siteName: "دار العقار",
  siteSubtitle: "Dar Al Aqar Egypt",
  logoType: "image",
  logoIcon: "building",
  logoImageUrl: DEFAULT_BRAND_LOGO_PATH,
  logoHeightPx: DEFAULT_BRAND_LOGO_HEIGHT_PX,
  appIconUrl: "",
  faviconUrl: "",
  primaryColor: "#059669",
  primaryHoverColor: "#047857",
  secondaryColor: "#0f172a",
  accentColor: "#10b981",
  iconColor: "#059669",
  mapIconColor: "#047857",
  headerBackground: "white",
  colorSchemePreset: "emerald_pulse",
  fontFamily: "cairo",
  headingWeight: "bold",
  borderRadius: "curved",
};

const FONT_FAMILIES: Record<VisualIdentitySettings["fontFamily"], string> = {
  cairo: "'Cairo', sans-serif",
  alexandria: "'Alexandria', sans-serif",
  tajawal: "'Tajawal', sans-serif",
  almarai: "'Almarai', sans-serif",
  ibm_plex: "'IBM Plex Sans Arabic', sans-serif",
};

const BLEND_WITH_WHITE: Record<number, number> = {
  50: 0.94,
  100: 0.86,
  200: 0.72,
  300: 0.54,
  400: 0.34,
  500: 0.18,
  600: 0.08,
};

const BLEND_WITH_BLACK: Record<number, number> = {
  800: 0.18,
  900: 0.38,
  950: 0.62,
};

function blend(color: number[], other: number[], amount: number): number[] {
  return color.map((channel, index) => Math.round(channel * (1 - amount) + other[index] * amount));
}

function toRgbChannels(hex: string): number[] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return [5, 150, 105];
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

export function getBrandThemeStyle(identity?: VisualIdentitySettings): CSSProperties {
  const primary = toRgbChannels(identity?.primaryColor || "#059669");
  const hover = toRgbChannels(identity?.primaryHoverColor || identity?.primaryColor || "#047857");
  const variables: Record<string, string> = {};

  for (const [shadeText, amount] of Object.entries(BLEND_WITH_WHITE)) {
    const shade = Number(shadeText);
    variables[`--brand-${shade}`] = blend(primary, [255, 255, 255], amount).join(" ");
  }
  variables["--brand-700"] = primary.join(" ");
  for (const [shadeText, amount] of Object.entries(BLEND_WITH_BLACK)) {
    const shade = Number(shadeText);
    variables[`--brand-${shade}`] = blend(primary, [0, 0, 0], amount).join(" ");
  }
  variables["--brand-800"] = hover.join(" ");
  variables["--brand-secondary"] = toRgbChannels(identity?.secondaryColor || "#0f172a").join(" ");
  variables["--brand-accent"] = toRgbChannels(identity?.accentColor || "#10b981").join(" ");
  variables["--brand-icon-color"] = identity?.iconColor || "#059669";
  variables["--brand-map-icon-color"] = identity?.mapIconColor || "#047857";
  variables["--brand-map-icon-active-color"] = identity?.primaryHoverColor || "#064e3b";
  variables["--brand-heading-weight"] = {
    bold: "700",
    extrabold: "800",
    black: "900",
  }[identity?.headingWeight || "bold"];

  const radiusScale = identity?.borderRadius === "soft"
    ? [4, 6, 8, 12, 16, 20]
    : identity?.borderRadius === "rounded"
      ? [10, 14, 18, 22, 28, 36]
      : [6, 8, 12, 16, 24, 32];
  ["sm", "md", "lg", "xl", "2xl", "3xl"].forEach((key, index) => {
    variables[`--radius-${key}`] = `${radiusScale[index]}px`;
  });
  variables["--font-cairo"] = FONT_FAMILIES[identity?.fontFamily || "cairo"];

  return variables as CSSProperties;
}
