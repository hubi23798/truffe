import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PRIMARY_USER_ID, category } from "@/lib/db/schema";
import { env } from "@/env";

export default async function CategoriesPage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");

  const db = getDb();
  const categories = await db.query.category.findMany({
    where: eq(category.userId, PRIMARY_USER_ID),
    orderBy: [asc(category.name)],
  });

  const parents = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-fg-muted mt-1 text-sm">{categories.length} categories across {parents.length} groups</p>
      </div>

      <div className="space-y-4">
        {parents.map((parent) => {
          const children = childrenOf(parent.id);
          return (
            <div key={parent.id} className="border-border-subtle rounded-lg border">
              <div className="flex items-center justify-between p-3">
                <span className="font-medium">{parent.name}</span>
                <span className="text-fg-muted text-xs">{parent.kind}</span>
              </div>
              {children.length > 0 && (
                <div className="divide-border-subtle divide-y border-t">
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between px-4 py-2">
                      <span className={`text-sm ${child.isArchived ? "line-through opacity-50" : ""}`}>
                        {child.name}
                      </span>
                      <span className="text-fg-muted text-xs">{child.kind}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
