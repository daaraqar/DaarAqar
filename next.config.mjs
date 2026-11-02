/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  // Brotli/gzip compression of responses at the server level
  compress: true,
  poweredByHeader: false,
  images: {
    // Modern formats + responsive sizing delivered by next/image
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  experimental: {
    // Tree-shake big icon/label libraries at build time → smaller JS bundles
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [
      {
        // Immutable hashed assets — cached hard on device
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Service worker must always revalidate
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
