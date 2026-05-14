import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, categorizationRule, category } from "@/lib/db/schema";
import { env } from "@/env";

export default async function RulesPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const [rules, categories] = await Promise.all([
    db.query.categorizationRule.findMany({
      where: eq(categorizationRule.userId, PRIMARY_USER_ID),
      orderBy: [asc(categorizationRule.priority)],
    }),
    db.query.category.findMany({
      where: eq(category.userId, PRIMARY_USER_ID),
      orderBy: [asc(category.name)],
      columns: { id: true, name: true },
    }),
  ]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Categorization rules</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Rules run in priority order. First match wins.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="text-fg-muted text-sm">No rules yet. Create one via the API: POST /api/rules</p>
      ) : (
        <div className="divide-border-subtle divide-y rounded-lg border text-sm">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">{categoryName(rule.categoryId)}</p>
                <p className="text-fg-muted text-xs">
                  {rule.matchKind}: <code className="font-mono">{rule.matchValue}</code>
                </p>
                <p className="text-fg-muted text-xs">
                  Priority {rule.priority} · matched {rule.matchCount}×
                  {rule.lastMatchedAt ? ` · last ${new Date(rule.lastMatchedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <span className="text-fg-muted shrink-0 text-xs">{rule.source}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
