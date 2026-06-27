import { createServerClient } from "@/lib/supabase/server";

export async function resolveTenantId(req: Request): Promise<string> {
  const headerClaims = req.headers.get("x-supabase-jwt-claims");
  if (headerClaims) {
    const claims = JSON.parse(headerClaims) as { active_tenant_id?: string };
    if (claims.active_tenant_id) return claims.active_tenant_id;
  }
  // Decode JWT claims from the active session. The Custom Access Token Hook
  // injects active_tenant_id as a top-level JWT claim, not into app_metadata.
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
      ) as { active_tenant_id?: string };
      if (payload.active_tenant_id) return payload.active_tenant_id;
    } catch {
      // malformed token — fall through to throw below
    }
  }
  throw new Error("active_tenant_id missing from session");
}
