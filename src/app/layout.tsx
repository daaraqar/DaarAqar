import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Suspense } from "react";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PwaInstallPrompt from "@/components/layout/PwaInstallPrompt";
import PwaRegister from "@/components/layout/PwaRegister";
import CapacitorClientInit from "@/components/providers/CapacitorClientInit";
import { dbStore } from "@/lib/db/store";
import { getBrandThemeStyle } from "@/lib/brand-theme";

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const identity = (await dbStore.getCmsHomepageSettingsForDisplayAsync()).visualIdentity;
  return {
    themeColor: identity?.primaryColor || "#0f766e",
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await dbStore.getCmsHomepageSettingsForDisplayAsync();
  const identity = settings.visualIdentity;
  const appName = identity?.siteName || "دار العقار";
  const faviconUrl = identity?.faviconUrl || identity?.appIconUrl;

  return {
    title: settings.metaTitle || `${appName} | عقارات مركز ميت غمر وقراه`,
    description: settings.metaDescription || settings.heroDescription,
    applicationName: appName,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: appName,
    },
    formatDetection: {
      telephone: false,
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: faviconUrl
        ? [{ url: faviconUrl }]
        : [
            { url: "/favicon.ico?v=20261019", sizes: "any" },
            { url: "/icons/favicon-32x32.png?v=20261019", sizes: "32x32", type: "image/png" },
            { url: "/icons/icon-192x192.png?v=20261019", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512x512.png?v=20261019", sizes: "512x512", type: "image/png" },
          ],
      apple: [{ url: identity?.appIconUrl || "/icons/apple-touch-icon.png?v=20261019" }],
    },
    keywords: [
      "عقارات ميت غمر",
      "عقارات مركز ميت غمر وقراه",
      "شقق للبيع في ميت غمر",
      "عقارات الدقهلية",
      "قرى مركز ميت غمر",
      "دار العقار",
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await dbStore.getCmsHomepageSettingsForDisplayAsync();
  return (
    <html lang="ar" dir="rtl" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        </head>
      <body
        style={getBrandThemeStyle(settings.visualIdentity)}
        className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-brand-500 selection:text-white"
      >
        <CapacitorClientInit />
        <PwaRegister />
        <Navbar />
        <PwaInstallPrompt />
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,16px))]">{children}</main>
        <Footer />
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </body>
    </html>
  );
}
