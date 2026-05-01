import { NextResponse, type NextRequest } from "next/server";

// -- Public route allowlist --------------------------------------------
//
// Anything not in this list (and not a static-asset prefix) requires a
// session cookie. The proxy checks cookie *presence* only — Edge runtime
// can't reach Postgres, so route handlers and Server Components
// re-validate the session against the DB.

const PUBLIC_PATHS = [
  "/login",
  "/enroll",
  "/api/health",
  "/api/auth/bootstrap",
  "/api/auth/register/options",
  "/api/auth/register/verify",
  "/api/auth/login/options",
  "/api/auth/login/verify",
  // Logout is intentionally NOT public: hitting it without a session is a
  // no-op (returns 200 either way), but we want session-bearing requests
  // only so that the audit log accurately attributes the action.
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "session";
  const sessionId = req.cookies.get(cookieName)?.value;

  if (isPublic(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (!sessionId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
