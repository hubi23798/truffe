import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// -- Enums --------------------------------------------------------------

export const riskToleranceEnum = pgEnum("risk_tolerance", [
  "conservative",
  "moderate",
  "aggressive",
]);

export const auditActorEnum = pgEnum("audit_actor", ["user", "advisor", "system", "cron"]);

// -- Tables -------------------------------------------------------------

/**
 * Single-user app — `user` is effectively a one-row table.
 * Profile fields are user-editable; never written by the advisor.
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
 * WebAuthn credentials. One row per device (one user can enroll many).
 * `credential_id` is unique across all credentials.
 */
export const passkeyCredential = pgTable(
  "passkey_credential",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    signCount: bigint("sign_count", { mode: "number" }).notNull().default(0),
    transports: jsonb("transports").$type<string[]>().notNull().default([]),
    nickname: text("nickname"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("passkey_credential_credential_id_unique").on(t.credentialId)],
);

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
 * Auth-infrastructure: short-TTL WebAuthn challenges for register / login
 * ceremonies. CSRF-protected by the challenge value itself; consumed once.
 */
export const challenge = pgTable("challenge", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  purpose: text("purpose").notNull(), // 'register' | 'login'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumed: boolean("consumed").notNull().default(false),
});

/**
 * Auth-infrastructure: single-use first-passkey enrollment tokens.
 * Hash is stored, never the token itself.
 */
export const bootstrapToken = pgTable("bootstrap_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// -- Inferred types -----------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type PasskeyCredential = typeof passkeyCredential.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Challenge = typeof challenge.$inferSelect;
export type BootstrapToken = typeof bootstrapToken.$inferSelect;
