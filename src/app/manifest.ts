import { MetadataRoute } from "next";
import { dbStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await dbStore.getCmsHomepageSettingsForDisplayAsync();
  const identity = settings.visualIdentity;
  const appName = identity?.siteName || "دار العقار";
  const appIconUrl = identity?.appIconUrl;
  const icons = appIconUrl
    ? [{ src: appIconUrl, sizes: "any", purpose: "any" as const }]
    : [
        { src: "/icons/icon-192x192.png?v=20261019", sizes: "192x192", type: "image/png", purpose: "any" as const },
        { src: "/icons/icon-512x512.png?v=20261019", sizes: "512x512", type: "image/png", purpose: "any" as const },
        { src: "/icons/icon-512x512.png?v=20261019", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
        { src: "/icons/apple-touch-icon.png?v=20261019", sizes: "180x180", type: "image/png", purpose: "any" as const },
      ];
  const shortcutIcon = appIconUrl
    ? { src: appIconUrl, sizes: "any" }
    : { src: "/icons/icon-192x192.png?v=20261019", sizes: "192x192", type: "image/png" };
  return {
    name: `${appName} | ${identity?.siteSubtitle || "Dar Al Aqar Egypt"}`,
    short_name: appName,
    description: settings.metaDescription || settings.heroDescription,
    start_url: "/?source=pwa",
    id: "/?source=pwa",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: identity?.primaryColor || "#0f766e",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    icons,
    shortcuts: [
      {
        name: "الخريطة الذكية",
        short_name: "الخريطة",
        description: "استكشف العقارات مباشرة على الخريطة التفاعلية",
        url: "/explore",
        icons: [shortcutIcon],
      },
      {
        name: "عقارات للبيع",
        short_name: "بيع",
        description: "شقق وفيلات للبيع في مصر",
        url: "/properties?transactionType=sale",
        icons: [shortcutIcon],
      },
      {
        name: "عقارات للإيجار",
        short_name: "إيجار",
        description: "شقق ووحدات للإيجار الفوري",
        url: "/properties?transactionType=rent",
        icons: [shortcutIcon],
      },
      {
        name: "أضف عقارك",
        short_name: "إضافة عقار",
        description: "أضف شقتك أو فيلتك للبيع أو الإيجار",
        url: "/dashboard/properties/new",
        icons: [shortcutIcon],
      },
    ],
  };
}
