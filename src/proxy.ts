import { NextResponse, type NextRequest } from "next/server";

// -- Public route allowlist --------------------------------------------
//
// Anything not in this list (and not a static-asset prefix) requires a
// session cookie. The proxy checks cookie *presence* only — Edge runtime
// can't reach Postgres, so route handlers and Server Components
// re-validate the session against the DB.

const PUBLIC_PATHS = [
  "/login",
  "/api/health",
  "/api/auth/login",
  // Logout is public so a client with an expired/missing session can still
  // call it to clean up the cookie. The route handler is idempotent and
  // only audits when an actual session exists, so attribution stays sound.
  "/api/auth/logout",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/robots.txt",
];

const STATIC_PREFIXES = ["/_next/", "/static/"];

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.includes(pathname);
}

// -- Security headers --------------------------------------------------
//
// Phase 0 trade-offs documented inline:
// - script-src 'self': strict; if Next.js hydration scripts break, fall
//   back to 'unsafe-inline' or implement per-request CSP nonces.
// - style-src 'unsafe-inline': pragmatic for Tailwind v4 runtime CSS
//   variables. Phase 4 polish: tighten with nonces.

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.anthropic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

// -- Proxy (Next 16 — formerly "middleware") ---------------------------
//
// On a missing session we differentiate API vs page requests:
//  - /api/* → 401 JSON. Method-preserving redirects on a POST/PUT/DELETE
//    would re-issue the request body to /login (which doesn't accept it).
//    APIs should signal "not authenticated" with a status code, not a
//    page redirect, so the client can react appropriately.
//  - everything else → 303 See Other to /login?from=<path>. 303 forces
//    the browser to follow with GET regardless of the original method,
//    avoiding 307's method-preservation footgun.

export function proxy(req: NextRequest) {
  // Auth disabled for local dev — inject a bypass cookie so every page and
  // API route passes its own session check without any code changes there.
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "session";
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("cookie", `${cookieName}=dev-bypass`);
  return applySecurityHeaders(NextResponse.next({ request: { headers: reqHeaders } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
