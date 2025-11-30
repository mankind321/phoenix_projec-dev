import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⛔ Disable Lightning CSS to prevent PDF export color parsing errors
  experimental: {
    optimizeCss: false,
  },

  // ✅ NEW LOCATION for PDFKit compatibility
  serverExternalPackages: ["pdfkit", "blob-stream"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
