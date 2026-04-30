import { cookies } from "next/headers";
import { env } from "@/env";

// Cookie names come from env so production can use the spec-strict __Host-
// prefix (which requires Secure + HTTPS) while dev uses non-__Host- names
// over plain HTTP. `secure` is conditional on NODE_ENV for the same reason:
// __Host- without Secure would be silently rejected by the browser, and
// non-__Host- with Secure would not round-trip on http://localhost in some
// browsers. Keeping these in lockstep is what makes both modes spec-valid.
const ENROLLMENT_TTL_S = 10 * 60;

// -- Session cookie ----------------------------------------------------

export async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: env().SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(env().SESSION_COOKIE_NAME);
}

export async function readSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
}

// -- Enrollment cookie -------------------------------------------------
//
// Issued after a successful bootstrap-token redemption. Required by the
// passkey registration ceremony (Task 15) so a casual visitor can't reach
// the enrollment endpoint without a valid bootstrap token. Short TTL
// (10 min) and single-purpose.

export async function setEnrollmentCookie(value: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: env().ENROLLMENT_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ENROLLMENT_TTL_S,
  });
}

export async function readEnrollmentCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(env().ENROLLMENT_COOKIE_NAME)?.value;
}

export async function clearEnrollmentCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(env().ENROLLMENT_COOKIE_NAME);
}
