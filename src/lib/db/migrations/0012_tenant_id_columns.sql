-- Phase A: add tenant_id to all tenant-owned tables.
-- Two-pass per table: add nullable column, backfill from seeded primary tenant,
-- then NOT NULL + FK + index. Forward-only.

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
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id uuid', t);
    EXECUTE format('UPDATE %I SET tenant_id = %L WHERE tenant_id IS NULL', t, '00000000-0000-0000-0000-0000000000aa');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE RESTRICT',
      t,
      t || '_tenant_id_fkey'
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', t || '_tenant_id_idx', t);
  END LOOP;
END $$;
