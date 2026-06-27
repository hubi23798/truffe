-- Phase A: enable RLS + tenant-isolation policies on all tenant-owned tables.
-- Service-role connections bypass RLS by design (Supabase managed).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'account', 'transaction', 'category', 'categorization_rule',
    'balance_snapshot', 'import_batch', 'import_batch_rejection',
    'budget_target', 'advisor_conversation', 'advisor_message',
    'pending_proposal', 'recurring_subscription', 'recurring_dismissal',
    'goal', 'weekly_debrief'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO authenticated USING (tenant_id = (auth.jwt() ->> ''active_tenant_id'')::uuid) WITH CHECK (tenant_id = (auth.jwt() ->> ''active_tenant_id'')::uuid)',
      t
    );
  END LOOP;
END $$;

-- tenant: members can read tenants they belong to.
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_read ON tenant
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT tenant_id FROM tenant_member
    WHERE user_id = auth.uid() AND revoked_at IS NULL
  ));

-- tenant_member: user can read own membership rows and rows for their active tenant.
ALTER TABLE tenant_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_self_read ON tenant_member
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id = (auth.jwt() ->> 'active_tenant_id')::uuid
  );
