ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "default_tenant_id" uuid REFERENCES "tenant"("id") ON DELETE SET NULL;
