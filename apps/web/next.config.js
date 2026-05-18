/** @type {import('next').NextConfig} */
const connectSrc =
  process.env.NODE_ENV !== "production"
    ? "'self' https://www.googleapis.com http://localhost:4000 ws: wss:"
    : "'self' https://www.googleapis.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";
const imgSrc =
  process.env.NODE_ENV !== "production"
    ? "'self' data: http://localhost:4000 https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com"
    : "'self' data: https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "drive.usercontent.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
    // Cache static assets aggressively — Next.js content-hashes these filenames
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // Cache public assets for 1 week
    {
      source: "/favicon.ico",
      headers: [
        { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
      ],
    },
  ],

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://hr-software-api.vercel.app/api/v1"
        : "http://localhost:4000/api/v1"),
  },
};

module.exports = nextConfig;
