/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev ? "'self' 'unsafe-eval' 'unsafe-inline'" : "'self'";
const styleSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
const connectSrc = isDev
  ? "'self' https://www.googleapis.com http://localhost:4000 ws: wss:"
  : "'self' https://www.googleapis.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";
const imgSrc = isDev
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
        {
          key: "Content-Security-Policy",
          value: `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src ${imgSrc}; frame-src https://drive.google.com; connect-src ${connectSrc}; object-src 'none'; base-uri 'self';`,
        },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
  ],
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  },
};

module.exports = nextConfig;
