import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// -- Constants ----------------------------------------------------------

/**
 * Single-user app. The user row is seeded by migration 0001 with this
 * fixed UUID so route handlers and the auth layer can reference "the
 * user" without a lookup. Email + password live in env (ADMIN_EMAIL,
 * ADMIN_PASSWORD), never in this row.
 */
export const PRIMARY_USER_ID = "00000000-0000-0000-0000-000000000001";

// -- Enums --------------------------------------------------------------

export const riskToleranceEnum = pgEnum("risk_tolerance", [
  "conservative",
  "moderate",
  "aggressive",
]);

export const auditActorEnum = pgEnum("audit_actor", ["user", "advisor", "system", "cron"]);

export const accountKindEnum = pgEnum("account_kind", [
  "cash",
  "investment",
  "crypto",
  "pension",
  "property",
  "other_asset",
  "liability",
]);

export const transactionStateEnum = pgEnum("transaction_state", [
  "pending",
  "completed",
  "reverted",
  "declined",
  "failed",
]);

export const categorizedByEnum = pgEnum("categorized_by", ["rule", "llm", "manual"]);

export const importBatchSourceKindEnum = pgEnum("import_batch_source_kind", ["revolut_csv"]);

export const importBatchStatusEnum = pgEnum("import_batch_status", [
  "pending",
  "parsing",
  "awaiting_account_confirmation",
  "done",
  "partial",
  "failed",
]);

export const categoryKindEnum = pgEnum("category_kind", [
  "income",
  "expense",
  "transfer",
  "investment_flow",
]);

export const ruleMatchKindEnum = pgEnum("rule_match_kind", [
  "description_contains",
  "description_regex",
  "type_raw_equals",
  "amount_range",
  "account_id_equals",
]);

export const ruleSourceEnum = pgEnum("rule_source", ["user", "llm_accepted"]);

export const advisorMessageRoleEnum = pgEnum("advisor_message_role", [
  "user",
  "assistant",
  "tool",
]);

export const pendingProposalKindEnum = pgEnum("pending_proposal_kind", [
  "create_rule",
  "recategorize",
]);

export const pendingProposalStatusEnum = pgEnum("pending_proposal_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

export const frequencyEnum = pgEnum("frequency", ["weekly", "fortnightly", "monthly"]);

// -- Tables -------------------------------------------------------------

/**
 * Single-user app — `user` is effectively a one-row table seeded by
 * migration 0001 with PRIMARY_USER_ID.
 */
export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  locale: text("locale").notNull().default("en-IE"),
  birthYear: integer("birth_year"),
  timeHorizonYears: integer("time_horizon_years"),
  riskTolerance: riskToleranceEnum("risk_tolerance"),
  householdIncomeAnnualBaseCcy: bigint("household_income_annual_base_ccy", {
    mode: "number",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Server-side sessions. The cookie carries only the session id; revocation
 * is done by deleting rows here.
 */
export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
});

/**
 * Login-attempt log for per-IP rate limiting on POST /api/auth/login.
 * Append-only; queried with `attempted_at > now() - interval '15 minutes'`.
 */
export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ip: text("ip").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempt_ip_attempted_at_idx").on(t.ip, t.attemptedAt)],
);

/**
 * Append-only audit trail for every mutation. `actor` distinguishes
 * user / advisor / system / cron. `advisor_message_id` link added in Phase 3.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
  actor: auditActorEnum("actor").notNull(),
  action: text("action").notNull(),
  targetTable: text("target_table"),
  targetId: text("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  advisorMessageId: uuid("advisor_message_id").references(
    (): AnyPgColumn => advisorMessage.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Financial accounts — cash, investment, crypto, pension, property, liabilities.
 * `is_liquid` governs whether the account is included in liquid-asset totals.
 * Liabilities (kind='liability') are stored positive; net worth engine flips sign.
 */
export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: accountKindEnum("kind").notNull(),
  currency: text("currency").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isLiquid: boolean("is_liquid").notNull().default(false),
  externalProvider: text("external_provider"),
  externalAccountId: text("external_account_id"),
  liabilityTerms: jsonb("liability_terms"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tracks each CSV (or future source) file upload. `file_sha256` uniqueness
 * makes re-uploading the same file a fast no-op at the boundary.
 */
export const importBatch = pgTable("import_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => account.id, { onDelete: "set null" }),
  sourceKind: importBatchSourceKindEnum("source_kind").notNull(),
  fileSha256: text("file_sha256").notNull().unique(),
  status: importBatchStatusEnum("status").notNull().default("pending"),
  rowCount: integer("row_count"),
  acceptedCount: integer("accepted_count"),
  rejectedCount: integer("rejected_count"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  importedByUserId: uuid("imported_by_user_id")
    .notNull()
    .references(() => user.id),
  notes: text("notes"),
});

/**
 * Two-level category tree (parent groups + leaf categories).
 * Seed taxonomy ships with ~20 leaves across 7 parent groups.
 */
export const category = pgTable("category", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => category.id, {
    onDelete: "set null",
  }),
  kind: categoryKindEnum("kind").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Pattern-matching rules applied in priority order during categorization.
 * First match wins. LLM-accepted suggestions are stored here once promoted.
 */
export const categorizationRule = pgTable("categorization_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull(),
  matchKind: ruleMatchKindEnum("match_kind").notNull(),
  matchValue: text("match_value").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id),
  source: ruleSourceEnum("source").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
  matchCount: integer("match_count").notNull().default(0),
});

/**
 * Ledger of all financial movements. Amounts stored in native currency
 * (minor units). Base-currency value derived on read via fx_rate.
 * Deduplication key: (account_id, external_id) — only when external_id set.
 */
export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    amountNative: bigint("amount_native", { mode: "number" }).notNull(),
    feeNative: bigint("fee_native", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull(),
    state: transactionStateEnum("state").notNull(),
    descriptionRaw: text("description_raw"),
    typeRaw: text("type_raw"),
    productRaw: text("product_raw"),
    runningBalanceNative: bigint("running_balance_native", { mode: "number" }),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    categorizedBy: categorizedByEnum("categorized_by"),
    categorizationRuleId: uuid("categorization_rule_id").references(
      () => categorizationRule.id,
      { onDelete: "set null" },
    ),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatch.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transaction_account_id_started_at_idx").on(t.accountId, t.startedAt),
    index("transaction_category_id_idx").on(t.categoryId),
    index("transaction_import_batch_id_idx").on(t.importBatchId),
    uniqueIndex("transaction_account_external_id_udx")
      .on(t.accountId, t.externalId)
      .where(sql`"external_id" IS NOT NULL`),
  ],
);

/**
 * Sidecar table for the never-silent-drop guarantee. Every row that fails
 * ingestion validation is recorded here with its raw content and reason.
 */
export const importBatchRejection = pgTable("import_batch_rejection", {
  id: uuid("id").primaryKey().defaultRandom(),
  importBatchId: uuid("import_batch_id")
    .notNull()
    .references(() => importBatch.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  rawRowJson: jsonb("raw_row_json").notNull(),
  reason: text("reason").notNull(),
});

/**
 * Daily per-account balance close, written by cron and first-ingest backfill.
 * Truth for net worth charts. Composite PK (account_id, as_of_date).
 */
export const balanceSnapshot = pgTable(
  "balance_snapshot",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    asOfDate: date("as_of_date", { mode: "string" }).notNull(),
    balanceNative: bigint("balance_native", { mode: "number" }).notNull(),
    balanceBaseCcy: bigint("balance_base_ccy", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.asOfDate] })],
);

/**
 * ECB daily FX rates relative to base currency (EUR). Composite PK.
 * Missing dates fall back to most recent prior date at query time.
 */
export const fxRate = pgTable(
  "fx_rate",
  {
    asOfDate: date("as_of_date", { mode: "string" }).notNull(),
    currency: text("currency").notNull(),
    rateToBase: numeric("rate_to_base", { precision: 20, scale: 10 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.asOfDate, t.currency] })],
);

/**
 * Monthly spend targets per leaf category. One row per (user, category).
 * Upsert-based — updating overwrites the previous value. No target history.
 */
export const budgetTarget = pgTable(
  "budget_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    amountMonthly: bigint("amount_monthly", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_target_user_category_udx").on(t.userId, t.categoryId)],
);

export const advisorConversation = pgTable("advisor_conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});

export const advisorMessage = pgTable(
  "advisor_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => advisorConversation.id, { onDelete: "cascade" }),
    role: advisorMessageRoleEnum("role").notNull(),
    contentText: text("content_text"),
    toolCalls: jsonb("tool_calls"),
    toolResults: jsonb("tool_results"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("advisor_message_conversation_id_created_at_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

export const pendingProposal = pgTable(
  "pending_proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advisorMessageId: uuid("advisor_message_id")
      .notNull()
      .references(() => advisorMessage.id, { onDelete: "cascade" }),
    kind: pendingProposalKindEnum("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: pendingProposalStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("pending_proposal_status_created_at_idx").on(t.status, t.createdAt),
  ],
);

export const recurringSubscription = pgTable(
  "recurring_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    detectionKey: text("detection_key"),
    name: text("name").notNull(),
    frequency: frequencyEnum("frequency").notNull(),
    amountNative: bigint("amount_native", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    categoryId: uuid("category_id").references(() => category.id, { onDelete: "set null" }),
    nextDue: date("next_due", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_subscription_user_id_idx").on(t.userId)],
);

export const recurringDismissal = pgTable(
  "recurring_dismissal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recurring_dismissal_user_id_key_idx").on(t.userId, t.key)],
);

// -- Inferred types -----------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type LoginAttempt = typeof loginAttempt.$inferSelect;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type ImportBatch = typeof importBatch.$inferSelect;
export type NewImportBatch = typeof importBatch.$inferInsert;
export type ImportBatchRejection = typeof importBatchRejection.$inferSelect;
export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;
export type CategorizationRule = typeof categorizationRule.$inferSelect;
export type NewCategorizationRule = typeof categorizationRule.$inferInsert;
export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;
export type BalanceSnapshot = typeof balanceSnapshot.$inferSelect;
export type FxRate = typeof fxRate.$inferSelect;
export type BudgetTarget = typeof budgetTarget.$inferSelect;
export type NewBudgetTarget = typeof budgetTarget.$inferInsert;
export type AdvisorConversation = typeof advisorConversation.$inferSelect;
export type NewAdvisorConversation = typeof advisorConversation.$inferInsert;
export type AdvisorMessage = typeof advisorMessage.$inferSelect;
export type NewAdvisorMessage = typeof advisorMessage.$inferInsert;
export type PendingProposal = typeof pendingProposal.$inferSelect;
export type NewPendingProposal = typeof pendingProposal.$inferInsert;
export type RecurringSubscription = typeof recurringSubscription.$inferSelect;
export type NewRecurringSubscription = typeof recurringSubscription.$inferInsert;
export type RecurringDismissal = typeof recurringDismissal.$inferSelect;
export type NewRecurringDismissal = typeof recurringDismissal.$inferInsert;
