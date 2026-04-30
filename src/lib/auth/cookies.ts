import { cookies } from "next/headers";
import { env } from "@/env";

const ENROLLMENT_COOKIE = "__Host-enrollment";
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
    name: ENROLLMENT_COOKIE,
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
  return cookieStore.get(ENROLLMENT_COOKIE)?.value;
}

export async function clearEnrollmentCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ENROLLMENT_COOKIE);
}
