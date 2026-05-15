import { NextRequest, NextResponse } from "next/server";

const connectSrc =
  process.env.NODE_ENV !== "production"
    ? "'self' https://www.googleapis.com http://localhost:4000 ws: wss:"
    : "'self' https://www.googleapis.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";

const imgSrc =
  process.env.NODE_ENV !== "production"
    ? "'self' data: http://localhost:4000 https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com"
    : "'self' data: https://drive.google.com https://drive.usercontent.google.com/ https://lh3.googleusercontent.com";

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(
    "content-security-policy",
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src ${imgSrc}`,
      "frame-src https://drive.google.com",
      `connect-src ${connectSrc}`,
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  );

  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(
    "Content-Security-Policy",
    requestHeaders.get("content-security-policy") ?? "",
  );
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
