import { NextRequest, NextResponse } from "next/server";

function getApiOrigin() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://hr-software-api.vercel.app/api/v1"
      : "http://localhost:4000/api/v1");

  try {
    return new URL(apiUrl).origin;
  } catch {
    return process.env.NODE_ENV === "production"
      ? "https://hr-software-api.vercel.app"
      : "http://localhost:4000";
  }
}

const apiOrigin = getApiOrigin();
const connectSrc =
  process.env.NODE_ENV !== "production"
    ? `'self' https://www.googleapis.com ${apiOrigin} ws: wss:`
    : `'self' https://www.googleapis.com ${apiOrigin} https://drive.usercontent.google.com/ https://lh3.googleusercontent.com`;

const imgSrc =
  process.env.NODE_ENV !== "production"
    ? "'self' data: http://localhost:4000 https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com"
    : "'self' data: https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Previous CSP included both 'unsafe-inline' and a nonce for script/style.
  // In CSP, once a nonce is present, 'unsafe-inline' is ignored for that directive.
  // Next.js app-router emits framework inline runtime/hydration scripts that must be
  // explicitly nonce-tagged; without full nonce propagation, those scripts are blocked.
  // Temporary production-safe debug posture: remove nonce usage entirely so hydration
  // can run. A strict nonce CSP requires end-to-end nonce wiring for all inline scripts.
  // Keep the API origin in connect-src so production login/fetch requests are allowed.
  requestHeaders.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSrc}`,
      "frame-src https://drive.google.com",
      `connect-src ${connectSrc}`,
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(
    "Content-Security-Policy",
    requestHeaders.get("content-security-policy") ?? "",
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
