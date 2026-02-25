import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  // Allow local network access during development
  // Add your local network IP addresses here
  allowedDevOrigins: [
    '192.168.1.3', // Your current local network IP
    '192.168.1.22', // Add your IP address
    // Add more IPs if needed, e.g.:
    // '192.168.1.3',
    // '10.0.0.2',
  ],

  // Caching headers for static assets (improves CDN/browser caching)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=86400",
          },
        ],
      },
      // Static assets in /public (match common image/font extensions)
      { source: "/:path*.(ico)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(png)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(jpg)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(jpeg)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(gif)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(webp)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(svg)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
      { source: "/:path*.(woff2)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400" }] },
    ];
  },

  // Image optimization: allow Cloudinary and other image domains for next/image
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
