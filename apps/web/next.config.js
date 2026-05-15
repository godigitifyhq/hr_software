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
