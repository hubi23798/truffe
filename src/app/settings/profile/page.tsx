import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, user } from "@/lib/db/schema";
import { env } from "@/env";
import { ProfileForm } from "./profile-form";

export default async function SettingsProfilePage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const profile = await db.query.user.findFirst({
    where: eq(user.id, PRIMARY_USER_ID),
    columns: {
      baseCurrency: true,
      locale: true,
      birthYear: true,
      timeHorizonYears: true,
      riskTolerance: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <a href="/settings" className="text-fg-muted text-sm hover:underline">← Settings</a>
        <h1 className="mt-2 text-xl font-semibold">Profile</h1>
        <p className="text-fg-muted mt-1 text-xs">Your preferences and financial context</p>
      </div>
      <ProfileForm profile={profile ?? null} />
    </main>
  );
}
