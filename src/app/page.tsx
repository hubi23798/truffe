import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { env } from "@/env";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

/**
 * Auth-gated home. The proxy (src/proxy.ts) already 303s unauthenticated
 * requests to /login, so this Server Component should normally only run
 * with a session cookie present. We re-validate against the DB here as
 * defense-in-depth — the proxy can only check cookie presence on Edge
 * runtime; a stale cookie pointing at a deleted session must still
 * redirect.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="border-border-subtle w-full max-w-md space-y-6 rounded-lg border p-6">
        <div>
          <h1 className="text-2xl font-semibold">boink!</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Phase 0 — you are signed in. The dashboard arrives in Phase 1.
          </p>
        </div>
        <LogoutButton />
      </div>
    </main>
  );
}
