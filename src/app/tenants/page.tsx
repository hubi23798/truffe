import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db/client";
import { tenant, tenantMember } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export default async function TenantPicker() {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const db = getDb();
  const memberships = await db
    .select({ id: tenant.id, name: tenant.name })
    .from(tenantMember)
    .innerJoin(tenant, eq(tenantMember.tenantId, tenant.id))
    .where(
      and(eq(tenantMember.userId, userData.user.id), isNull(tenantMember.revokedAt)),
    );

  if (memberships.length === 1) redirect(`/?tenant=${memberships[0]!.id}`);

  return (
    <main className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Choose a workspace</h1>
      <ul className="space-y-2">
        {memberships.map((m) => (
          <li key={m.id}>
            <form action="/api/tenants/switch" method="POST">
              <input type="hidden" name="tenantId" value={m.id} />
              <button className="w-full text-left p-4 rounded border hover:bg-muted">
                {m.name}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
