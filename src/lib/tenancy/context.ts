import { createServerClient } from "@/lib/supabase/server";

export async function resolveTenantId(req: Request): Promise<string> {
  const headerClaims = req.headers.get("x-supabase-jwt-claims");
  if (headerClaims) {
    const claims = JSON.parse(headerClaims) as { active_tenant_id?: string };
    if (claims.active_tenant_id) return claims.active_tenant_id;
  }
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const id = (data.user?.app_metadata as { active_tenant_id?: string } | null)
    ?.active_tenant_id;
  if (!id) throw new Error("active_tenant_id missing from session");
  return id;
}
