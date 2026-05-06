import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// -- Inferred types -----------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type LoginAttempt = typeof loginAttempt.$inferSelect;
