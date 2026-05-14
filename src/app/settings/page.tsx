import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/env";

const items = [
  { href: "/settings/import", label: "Import CSV", description: "Upload Revolut CSV exports" },
  { href: "/settings/accounts", label: "Accounts", description: "Rename, archive, set liquidity" },
  { href: "/settings/categories", label: "Categories", description: "Manage spending categories" },
  { href: "/settings/rules", label: "Rules", description: "Auto-categorization rules" },
  { href: "/settings/profile", label: "Profile", description: "Currency, locale, risk tolerance" },
  { href: "/settings/sessions", label: "Sessions", description: "Active sessions and sign-out" },
];

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="divide-border-subtle divide-y rounded-lg border text-sm">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-fg-muted text-xs">{item.description}</p>
            </div>
            <span className="text-fg-muted">→</span>
          </a>
        ))}
      </div>
    </main>
  );
}
