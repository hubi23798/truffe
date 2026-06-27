-- Backfill audit_log → audit_log_v2 with synthesized hash chain.
-- Existing rows tagged with seeded primary tenant since they predate tenancy.
-- Note: Postgres canonical JSON != Node canonical JSON. Chain verifies in-Postgres only
-- for backfilled rows. Forward rows written via appendAudit use Node canonicalization.
-- This is acceptable: backfill integrity is informational; forward integrity is what matters.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  r RECORD;
  prev_hash bytea := decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
  this_hash bytea;
  payload jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    RETURN;
  END IF;

  FOR r IN SELECT * FROM audit_log ORDER BY created_at ASC, id ASC LOOP
    payload := jsonb_build_object(
      'tenantId', '00000000-0000-0000-0000-0000000000aa',
      'actorUserId', r.actor_user_id,
      'action', r.action,
      'targetType', r.target_type,
      'targetId', r.target_id,
      'before', r.before,
      'after', r.after,
      'context', null
    );
    -- sha256(prev_hash || canonical(payload))
    this_hash := digest(prev_hash || convert_to(payload::text, 'UTF8'), 'sha256');

    INSERT INTO audit_log_v2 (
      tenant_id, actor_user_id, action, target_type, target_id,
      before, after, context, prev_hash, this_hash, created_at
    ) VALUES (
      '00000000-0000-0000-0000-0000000000aa',
      r.actor_user_id, r.action, r.target_type, r.target_id,
      r.before, r.after, NULL, prev_hash, this_hash, r.created_at
    );
    prev_hash := this_hash;
  END LOOP;
END $$;
