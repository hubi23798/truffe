-- Migration 0002: Phase 1 data model.
--
-- Adds accounts, transactions, import pipeline, categories,
-- categorization rules, balance snapshots, and FX rates.
-- Seeds the ~28-entry category taxonomy (7 parent groups + 21 leaves).

-- ── Enum types ─────────────────────────────────────────────────────────────

CREATE TYPE "account_kind" AS ENUM (
  'cash', 'investment', 'crypto', 'pension', 'property', 'other_asset', 'liability'
);--> statement-breakpoint

CREATE TYPE "transaction_state" AS ENUM (
  'pending', 'completed', 'reverted', 'declined', 'failed'
);--> statement-breakpoint

CREATE TYPE "categorized_by" AS ENUM ('rule', 'llm', 'manual');--> statement-breakpoint

CREATE TYPE "import_batch_source_kind" AS ENUM ('revolut_csv');--> statement-breakpoint

CREATE TYPE "import_batch_status" AS ENUM (
  'pending', 'parsing', 'awaiting_account_confirmation', 'done', 'partial', 'failed'
);--> statement-breakpoint

CREATE TYPE "category_kind" AS ENUM ('income', 'expense', 'transfer', 'investment_flow');--> statement-breakpoint

CREATE TYPE "rule_match_kind" AS ENUM (
  'description_contains', 'description_regex', 'type_raw_equals',
  'amount_range', 'account_id_equals'
);--> statement-breakpoint

CREATE TYPE "rule_source" AS ENUM ('user', 'llm_accepted');--> statement-breakpoint

-- ── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE "account" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"              uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"                 text NOT NULL,
  "kind"                 "account_kind" NOT NULL,
  "currency"             text NOT NULL,
  "is_active"            boolean NOT NULL DEFAULT true,
  "is_liquid"            boolean NOT NULL DEFAULT false,
  "external_provider"    text,
  "external_account_id"  text,
  "liability_terms"      jsonb,
  "notes"                text,
  "created_at"           timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- import_batch before transaction (transaction.import_batch_id → import_batch)
CREATE TABLE "import_batch" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id"           uuid REFERENCES "account"("id") ON DELETE SET NULL,
  "source_kind"          "import_batch_source_kind" NOT NULL,
  "file_sha256"          text NOT NULL UNIQUE,
  "status"               "import_batch_status" NOT NULL DEFAULT 'pending',
  "row_count"            integer,
  "accepted_count"       integer,
  "rejected_count"       integer,
  "imported_at"          timestamp with time zone DEFAULT now() NOT NULL,
  "imported_by_user_id"  uuid NOT NULL REFERENCES "user"("id"),
  "notes"                text
);--> statement-breakpoint

-- category before categorization_rule and transaction
CREATE TABLE "category" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"     uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "parent_id"   uuid REFERENCES "category"("id") ON DELETE SET NULL,
  "kind"        "category_kind" NOT NULL,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "categorization_rule" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"         uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "priority"        integer NOT NULL,
  "match_kind"      "rule_match_kind" NOT NULL,
  "match_value"     text NOT NULL,
  "category_id"     uuid NOT NULL REFERENCES "category"("id"),
  "source"          "rule_source" NOT NULL DEFAULT 'user',
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "last_matched_at" timestamp with time zone,
  "match_count"     integer NOT NULL DEFAULT 0
);--> statement-breakpoint

CREATE TABLE "transaction" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id"              uuid NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
  "external_id"             text,
  "started_at"              timestamp with time zone NOT NULL,
  "completed_at"            timestamp with time zone,
  "amount_native"           bigint NOT NULL,
  "fee_native"              bigint NOT NULL DEFAULT 0,
  "currency"                text NOT NULL,
  "state"                   "transaction_state" NOT NULL,
  "description_raw"         text,
  "type_raw"                text,
  "product_raw"             text,
  "running_balance_native"  bigint,
  "category_id"             uuid REFERENCES "category"("id") ON DELETE SET NULL,
  "categorized_by"          "categorized_by",
  "categorization_rule_id"  uuid REFERENCES "categorization_rule"("id") ON DELETE SET NULL,
  "import_batch_id"         uuid NOT NULL REFERENCES "import_batch"("id"),
  "created_at"              timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "transaction_account_id_started_at_idx"
  ON "transaction"("account_id", "started_at" DESC);--> statement-breakpoint
CREATE INDEX "transaction_category_id_idx"
  ON "transaction"("category_id");--> statement-breakpoint
CREATE INDEX "transaction_import_batch_id_idx"
  ON "transaction"("import_batch_id");--> statement-breakpoint

-- Partial unique index: dedup by (account_id, external_id) only when
-- external_id is set. Rows with synthetic external_ids (sha256 digest)
-- rely on ingestion-layer dedup logic instead.
CREATE UNIQUE INDEX "transaction_account_external_id_udx"
  ON "transaction"("account_id", "external_id")
  WHERE "external_id" IS NOT NULL;--> statement-breakpoint

CREATE TABLE "import_batch_rejection" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "import_batch_id" uuid NOT NULL REFERENCES "import_batch"("id") ON DELETE CASCADE,
  "row_index"       integer NOT NULL,
  "raw_row_json"    jsonb NOT NULL,
  "reason"          text NOT NULL
);--> statement-breakpoint

CREATE TABLE "balance_snapshot" (
  "account_id"       uuid NOT NULL REFERENCES "account"("id") ON DELETE CASCADE,
  "as_of_date"       date NOT NULL,
  "balance_native"   bigint NOT NULL,
  "balance_base_ccy" bigint NOT NULL,
  PRIMARY KEY ("account_id", "as_of_date")
);--> statement-breakpoint

CREATE TABLE "fx_rate" (
  "as_of_date"   date NOT NULL,
  "currency"     text NOT NULL,
  "rate_to_base" numeric(20, 10) NOT NULL,
  PRIMARY KEY ("as_of_date", "currency")
);--> statement-breakpoint

-- ── Category seed ──────────────────────────────────────────────────────────
-- 7 parent groups + 21 leaf categories = 28 total.
-- Fixed UUIDs ensure idempotent re-runs and stable FK references.
-- user_id = PRIMARY_USER_ID (seeded in migration 0001).

INSERT INTO "category" ("id", "user_id", "name", "parent_id", "kind") VALUES
  -- Parent groups (no parent_id)
  ('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000001','Needs',          NULL,'expense'),
  ('00000000-0000-0000-0001-000000000002','00000000-0000-0000-0000-000000000001','Lifestyle',      NULL,'expense'),
  ('00000000-0000-0000-0001-000000000003','00000000-0000-0000-0000-000000000001','Future Self',    NULL,'investment_flow'),
  ('00000000-0000-0000-0001-000000000004','00000000-0000-0000-0000-000000000001','Irregulars',     NULL,'expense'),
  ('00000000-0000-0000-0001-000000000005','00000000-0000-0000-0000-000000000001','Subscriptions',  NULL,'expense'),
  ('00000000-0000-0000-0001-000000000006','00000000-0000-0000-0000-000000000001','Income',         NULL,'income'),
  ('00000000-0000-0000-0001-000000000007','00000000-0000-0000-0000-000000000001','Transfers',      NULL,'transfer'),
  -- Needs
  ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0000-000000000001','Groceries',      '00000000-0000-0000-0001-000000000001','expense'),
  ('00000000-0000-0000-0002-000000000002','00000000-0000-0000-0000-000000000001','Rent & Housing', '00000000-0000-0000-0001-000000000001','expense'),
  ('00000000-0000-0000-0002-000000000003','00000000-0000-0000-0000-000000000001','Transport',      '00000000-0000-0000-0001-000000000001','expense'),
  ('00000000-0000-0000-0002-000000000004','00000000-0000-0000-0000-000000000001','Utilities',      '00000000-0000-0000-0001-000000000001','expense'),
  ('00000000-0000-0000-0002-000000000005','00000000-0000-0000-0000-000000000001','Healthcare',     '00000000-0000-0000-0001-000000000001','expense'),
  -- Lifestyle
  ('00000000-0000-0000-0002-000000000006','00000000-0000-0000-0000-000000000001','Dining Out',     '00000000-0000-0000-0001-000000000002','expense'),
  ('00000000-0000-0000-0002-000000000007','00000000-0000-0000-0000-000000000001','Entertainment',  '00000000-0000-0000-0001-000000000002','expense'),
  ('00000000-0000-0000-0002-000000000008','00000000-0000-0000-0000-000000000001','Shopping',       '00000000-0000-0000-0001-000000000002','expense'),
  ('00000000-0000-0000-0002-000000000009','00000000-0000-0000-0000-000000000001','Travel',         '00000000-0000-0000-0001-000000000002','expense'),
  ('00000000-0000-0000-0002-000000000010','00000000-0000-0000-0000-000000000001','Personal Care',  '00000000-0000-0000-0001-000000000002','expense'),
  -- Future Self
  ('00000000-0000-0000-0002-000000000011','00000000-0000-0000-0000-000000000001','Savings',        '00000000-0000-0000-0001-000000000003','investment_flow'),
  ('00000000-0000-0000-0002-000000000012','00000000-0000-0000-0000-000000000001','Investments',    '00000000-0000-0000-0001-000000000003','investment_flow'),
  -- Irregulars
  ('00000000-0000-0000-0002-000000000013','00000000-0000-0000-0000-000000000001','Home & Repairs', '00000000-0000-0000-0001-000000000004','expense'),
  ('00000000-0000-0000-0002-000000000014','00000000-0000-0000-0000-000000000001','Gifts & Donations','00000000-0000-0000-0001-000000000004','expense'),
  ('00000000-0000-0000-0002-000000000015','00000000-0000-0000-0000-000000000001','Tax',            '00000000-0000-0000-0001-000000000004','expense'),
  -- Subscriptions
  ('00000000-0000-0000-0002-000000000016','00000000-0000-0000-0000-000000000001','Streaming',      '00000000-0000-0000-0001-000000000005','expense'),
  ('00000000-0000-0000-0002-000000000017','00000000-0000-0000-0000-000000000001','Software & Services','00000000-0000-0000-0001-000000000005','expense'),
  -- Income
  ('00000000-0000-0000-0002-000000000018','00000000-0000-0000-0000-000000000001','Salary',         '00000000-0000-0000-0001-000000000006','income'),
  ('00000000-0000-0000-0002-000000000019','00000000-0000-0000-0000-000000000001','Freelance',      '00000000-0000-0000-0001-000000000006','income'),
  ('00000000-0000-0000-0002-000000000020','00000000-0000-0000-0000-000000000001','Investment Returns','00000000-0000-0000-0001-000000000006','income'),
  -- Transfers
  ('00000000-0000-0000-0002-000000000021','00000000-0000-0000-0000-000000000001','Internal Transfer','00000000-0000-0000-0001-000000000007','transfer')
ON CONFLICT ("id") DO NOTHING;
