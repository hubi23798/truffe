-- Phase A follow-up: tighten tenant_member constraints.

-- 1. Index for user → tenants lookup (auth-time query pattern).
CREATE INDEX IF NOT EXISTS tenant_member_user_id_idx
  ON tenant_member (user_id)
  WHERE revoked_at IS NULL;

-- 2. Switch invited_by FK action to SET NULL so deleting a former inviter
--    does not block unrelated user deletions.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'tenant_member'::regclass
    AND contype = 'f'
    AND (SELECT attname FROM pg_attribute
         WHERE attrelid = 'tenant_member'::regclass
           AND attnum = ANY(conkey) LIMIT 1) = 'invited_by';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenant_member DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE tenant_member
  ADD CONSTRAINT tenant_member_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES "user"(id) ON DELETE SET NULL;

-- 3. Disallow revoking before accepting / before invite.
ALTER TABLE tenant_member
  ADD CONSTRAINT tenant_member_revoked_after_accepted_chk
  CHECK (
    revoked_at IS NULL
    OR accepted_at IS NULL
    OR revoked_at >= accepted_at
  );
