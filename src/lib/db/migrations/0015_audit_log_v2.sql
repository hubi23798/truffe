CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "audit_log_v2" (
  "id" bigserial PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id"),
  "actor_user_id" uuid REFERENCES "user"("id"),
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "before" jsonb,
  "after" jsonb,
  "context" jsonb,
  "prev_hash" bytea NOT NULL,
  "this_hash" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_v2_tenant_created_idx"
  ON "audit_log_v2" ("tenant_id", "created_at");

ALTER TABLE "audit_log_v2" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "audit_log_v2"
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'active_tenant_id')::uuid);

REVOKE INSERT, UPDATE, DELETE ON "audit_log_v2" FROM authenticated;
