import { cookies } from "next/headers";
import { env } from "@/env";

// Session cookie name comes from env so production can use the spec-strict
// __Host- prefix (which requires Secure + HTTPS) while dev uses a plain
// "session" name over HTTP. `secure` is conditional on NODE_ENV for the
// same reason: __Host- without Secure would be silently rejected by the
// browser. Keeping these in lockstep is what makes both modes spec-valid.

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
