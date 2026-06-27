export async function resolveTenantId(req: Request): Promise<string> {
  const headerClaims = req.headers.get("x-supabase-jwt-claims");
  if (headerClaims) {
    const claims = JSON.parse(headerClaims) as { active_tenant_id?: string };
    if (claims.active_tenant_id) return claims.active_tenant_id;
  }
  // Supabase session fallback added in Task 7 (createServerClient not yet available).
  throw new Error("active_tenant_id missing from session");
}
