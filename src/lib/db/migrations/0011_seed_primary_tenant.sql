-- Seed one tenant for the existing primary user so all subsequent
-- tenant_id backfills (migration 0012+) have a target.

INSERT INTO tenant (id, name, plan, region)
VALUES (
  '00000000-0000-0000-0000-0000000000aa',
  'Primary',
  'family_office',
  'us'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_member (tenant_id, user_id, role, scope, accepted_at)
SELECT
  '00000000-0000-0000-0000-0000000000aa',
  u.id,
  'owner',
  'full_read',
  now()
FROM "user" u
WHERE u.id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id, user_id) DO NOTHING;
