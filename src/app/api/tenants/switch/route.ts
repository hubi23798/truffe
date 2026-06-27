import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db/client";
import { user, tenantMember } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  const form = await req.formData();
  const tenantId = String(form.get("tenantId") ?? "");
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const db = getDb();
  const [membership] = await db
    .select()
    .from(tenantMember)
    .where(
      and(
        eq(tenantMember.userId, userData.user.id),
        eq(tenantMember.tenantId, tenantId as string),
        isNull(tenantMember.revokedAt),
      ),
    );
  if (!membership) return NextResponse.json({ error: "no membership" }, { status: 403 });

  await db.update(user).set({ defaultTenantId: tenantId }).where(eq(user.id, userData.user.id));
  await supabase.auth.refreshSession();
  return NextResponse.redirect(new URL("/", req.url));
}
