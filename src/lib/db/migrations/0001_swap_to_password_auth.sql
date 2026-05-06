-- Migration 0001: replace passkey-based auth with single-user password auth.
--
-- Drops the WebAuthn / bootstrap tables (passkey_credential, challenge,
-- bootstrap_token) and adds login_attempt for per-IP rate limiting on
-- POST /api/auth/login. Seeds the single user row with the fixed
-- PRIMARY_USER_ID so route handlers can reference "the user" without
-- a lookup. Email + password live in env, never in the DB.

-- 1. Drop FK constraints from soon-to-be-dropped tables.
ALTER TABLE "passkey_credential" DROP CONSTRAINT IF EXISTS "passkey_credential_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "challenge" DROP CONSTRAINT IF EXISTS "challenge_user_id_user_id_fk";--> statement-breakpoint

-- 2. Drop obsolete auth tables.
DROP TABLE IF EXISTS "passkey_credential";--> statement-breakpoint
DROP TABLE IF EXISTS "challenge";--> statement-breakpoint
DROP TABLE IF EXISTS "bootstrap_token";--> statement-breakpoint

-- 3. Create login_attempt for per-IP rate limiting.
CREATE TABLE "login_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "login_attempt_ip_attempted_at_idx" ON "login_attempt" USING btree ("ip","attempted_at");--> statement-breakpoint

-- 4. Seed the single user with PRIMARY_USER_ID. Idempotent re-runs are
--    no-ops thanks to ON CONFLICT.
INSERT INTO "user" ("id")
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT ("id") DO NOTHING;
