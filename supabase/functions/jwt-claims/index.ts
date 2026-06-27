import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface HookPayload {
  user_id: string;
  claims: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const payload = (await req.json()) as HookPayload;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pick the user's default tenant. Fallback: first active membership.
  const { data } = await admin
    .from("user")
    .select("default_tenant_id")
    .eq("id", payload.user_id)
    .maybeSingle();

  let activeTenantId: string | null = data?.default_tenant_id ?? null;

  if (!activeTenantId) {
    const { data: membership } = await admin
      .from("tenant_member")
      .select("tenant_id")
      .eq("user_id", payload.user_id)
      .is("revoked_at", null)
      .order("invited_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = membership?.tenant_id ?? null;
  }

  return new Response(
    JSON.stringify({
      claims: { ...payload.claims, active_tenant_id: activeTenantId },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
