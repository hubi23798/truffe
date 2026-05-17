# Recurring Transactions — Design Spec
**Date:** 2026-05-17
**Scope:** Phase 2 — recurring detection + confirmed subscriptions + budget integration

---

## 1. Goal

Build on the existing detection scaffold to give the user a curated list of confirmed subscriptions, with dismissed false positives, manual additions, and automatic budget target proposals when a category is set.

---

## 2. Data Model

### New tables in `src/lib/db/schema.ts`

**`frequency_enum`** (new pgEnum)
```
'weekly' | 'fortnightly' | 'monthly'
```

**`recurring_subscription`**
```
id             uuid         PK, defaultRandom()
user_id        uuid         FK → user(id) ON DELETE CASCADE, NOT NULL
detection_key  text         nullable — set when confirmed from auto-detect, null for manual adds
name           text         NOT NULL
frequency      frequency_enum  NOT NULL
amount_native  integer      NOT NULL (minor units; negative = expense, positive = income)
currency       text         NOT NULL
category_id    uuid         nullable FK → category(id) ON DELETE SET NULL
next_due       date         nullable
created_at     timestamptz  NOT NULL, defaultNow()
updated_at     timestamptz  NOT NULL, defaultNow()
```

Index: `(user_id)`.

**`recurring_dismissal`**
```
id          uuid         PK, defaultRandom()
user_id     uuid         FK → user(id) ON DELETE CASCADE, NOT NULL
key         text         NOT NULL  (the detection_key string)
created_at  timestamptz  NOT NULL, defaultNow()
UNIQUE (user_id, key)
```

### Type exports
`RecurringSubscription`, `NewRecurringSubscription`, `RecurringDismissal`, `NewRecurringDismissal`

### Migration
`pnpm db:generate` → `pnpm db:migrate`. Two new tables, no existing table changes.

---

## 3. Budget Proposal Logic

**File:** `src/lib/recurring/budget-proposal.ts`

Pure function — no DB access:

```typescript
export type BudgetProposalAction =
  | { action: 'none' }
  | { action: 'create'; amount: number }
  | { action: 'conflict'; existingAmount: number; proposedAmount: number };

export function computeBudgetProposal(
  categoryId: string | null,
  subscriptionAmount: number,
  existingTarget: number | null,
): BudgetProposalAction
```

Rules:
- `categoryId` is null → `{ action: 'none' }`
- No existing target → `{ action: 'create', amount: Math.abs(subscriptionAmount) }`
- Existing target === `Math.abs(subscriptionAmount)` → `{ action: 'none' }`
- Existing target differs → `{ action: 'conflict', existingAmount: existingTarget, proposedAmount: Math.abs(subscriptionAmount) }`

---

## 4. API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/recurring/subscriptions` | Create confirmed subscription |
| `PATCH` | `/api/recurring/subscriptions/[id]` | Edit subscription |
| `DELETE` | `/api/recurring/subscriptions/[id]` | Remove subscription |
| `POST` | `/api/recurring/dismissals` | Dismiss a detection key |

Budget target updates on conflict reuse the existing `PUT /api/budget-targets/[categoryId]`.

### POST /api/recurring/subscriptions

Body:
```typescript
{
  detectionKey?: string;
  name: string;
  frequency: 'weekly' | 'fortnightly' | 'monthly';
  amountNative: number;  // minor units, negative=expense
  currency: string;
  categoryId?: string;
  nextDue?: string;  // YYYY-MM-DD
}
```

Response:
```typescript
{
  subscription: RecurringSubscription;
  budgetCreated?: true;       // budget target auto-created
  budgetConflict?: {
    existingAmount: number;
    proposedAmount: number;
    categoryName: string;
  };
}
```

Steps:
1. Validate body with Zod.
2. Insert `recurring_subscription`.
3. If `categoryId` set: look up existing `budget_target` for `(PRIMARY_USER_ID, categoryId)`.
4. Apply `computeBudgetProposal` to determine action.
5. `create` → insert `budget_target`, return `budgetCreated: true`.
6. `conflict` → look up category name, return `budgetConflict`.
7. `none` → return just `{ subscription }`.

### PATCH /api/recurring/subscriptions/[id]

Same body fields (all optional). Same budget proposal logic on save if `categoryId` or `amountNative` changed.

### DELETE /api/recurring/subscriptions/[id]

Deletes subscription row. Does not touch `budget_target`.

### POST /api/recurring/dismissals

Body: `{ key: string }`. Upsert into `recurring_dismissal` (conflict on `(user_id, key)` → do nothing).

---

## 5. Page Architecture

### Server wrapper: `src/app/recurring/page.tsx`

Fetches initial data, passes as props to `RecurringView`:
1. Load `recurring_subscription` rows for `PRIMARY_USER_ID`.
2. Load `recurring_dismissal` keys for `PRIMARY_USER_ID`.
3. Load transactions from last 3 months, run `detectRecurring()`.
4. Filter candidates: remove detection keys already in subscriptions or dismissals.
5. Load all leaf expense/investment_flow categories (for the category picker).
6. Load user base currency.
7. Load account names.
8. Render `<RecurringView ... />`.

### Client component: `src/app/recurring/recurring-view.tsx`

`"use client"`. Props:
```typescript
interface RecurringViewProps {
  subscriptions: RecurringSubscription[];
  candidates: RecurringItem[];
  categories: { id: string; name: string; parentName: string }[];
  accountNames: Record<string, string>;
  currency: string;
}
```

State:
- `subs` — confirmed subscriptions (optimistic updates)
- `candidates` — detected unconfirmed items
- `expandedKey` — which inline form is open (`null` | detection_key | `'new'` | subscription id)
- `budgetConflicts` — map of subscription id → conflict data
- `error` — per-row error string

---

## 6. UI Layout

```
Recurring

€1,428/mo confirmed  ·  €73/mo detected        [+ Add subscription]

── Monthly ─────────────────────────────────────────────────────────
  Property Rent      −€1,200.00    due in 12d              [✏] [×]
  Netflix            −€17.99       due in 3d               [✏] [×]
  [budget conflict card: "Budget target for Entertainment is €15/mo
   — this subscription is €17.99/mo. Update?" [Update] [Keep]]

── Suggested ────────────────────────────────────────────────────────
  Spotify            −€10.99       monthly    [Confirm] [×]
    ↳ [inline confirm form — expands on Confirm click]
  Gym Direct Debit   −€45.00       monthly    [Confirm] [×]
```

**Summary strip**: Confirmed amount normalised to monthly (`weekly × 52/12`, `fortnightly × 26/12`, `monthly × 1`). Detected amount same calculation. Only subscriptions/candidates whose `currency` matches the user's base currency are included in the totals; others are silently excluded to avoid FX conversion complexity.

**Confirmed rows** (grouped monthly → fortnightly → weekly):
- Name, formatted amount (− prefix for expenses, + for income), next_due label from `daysLabel()`.
- Edit pencil → opens inline form in place.
- Remove × → `DELETE` immediately, optimistic removal.

**Suggested rows**:
- Description (from `RecurringItem`), amount, frequency label.
- **Confirm** → expand inline form below the row.
- **×** → `POST /api/recurring/dismissals`, optimistic removal from candidates list.

**Inline form** (shared for confirm, manual add, edit):
- Name (text input, pre-filled from description)
- Amount (number input in major units, pre-filled)
- Frequency (select: Monthly / Fortnightly / Weekly)
- Category (optional select — leaf expense/investment_flow categories shown as "Parent › Name")
- Next due (optional date input)
- **Save** / **Cancel** buttons

**Budget conflict card** (appears below confirmed row after save):
- "Budget target for [Category] is €X/mo — this subscription costs €Y/mo. Update?"
- **Update** → `PUT /api/budget-targets/[categoryId]` with new amount, card disappears.
- **Keep** → card disappears, no change.

**"+ Add subscription"** button: sets `expandedKey = 'new'`, shows blank inline form at top of confirmed section.

---

## 7. Files Touched / Created

**New:**
- `src/lib/recurring/budget-proposal.ts` — `computeBudgetProposal` pure function
- `src/app/recurring/recurring-view.tsx` — `"use client"` full UI
- `src/app/api/recurring/subscriptions/route.ts` — POST
- `src/app/api/recurring/subscriptions/[id]/route.ts` — PATCH + DELETE
- `src/app/api/recurring/dismissals/route.ts` — POST
- `tests/unit/recurring-budget.test.ts` — unit tests for `computeBudgetProposal`

**Modified:**
- `src/lib/db/schema.ts` — add `frequencyEnum`, `recurringSubscription`, `recurringDismissal`
- `src/app/recurring/page.tsx` — thin server wrapper (replaces current full page)

**Committed as-is (untracked → tracked):**
- `src/lib/recurring/detect.ts`
- `tests/unit/recurring.test.ts`

---

## 8. Tests

### `tests/unit/recurring.test.ts` (existing — commit as-is)

Already covers: monthly/weekly/fortnightly detection, single-occurrence ignored, irregular ignored, nextExpected computation, account separation.

### `tests/unit/recurring-budget.test.ts`

Tests `computeBudgetProposal(categoryId, subscriptionAmount, existingTarget)`:

| Scenario | Input | Expected |
|----------|-------|----------|
| No category | `null, -8999, null` | `{ action: 'none' }` |
| Category, no target | `'cat-1', -8999, null` | `{ action: 'create', amount: 8999 }` |
| Category, same amount | `'cat-1', -8999, 8999` | `{ action: 'none' }` |
| Category, different amount | `'cat-1', -8999, 8000` | `{ action: 'conflict', existingAmount: 8000, proposedAmount: 8999 }` |
| Income (positive) | `'cat-1', 175000, null` | `{ action: 'create', amount: 175000 }` |

---

## 9. Out of Scope

- Upcoming bills calendar / timeline view (Phase 3)
- Push/email notifications for overdue subscriptions
- Recurring income tracking in budget (only expenses currently affect budget targets)
- Advisor `get_recurring_subscriptions` tool (Phase 4 integration)
- Bi-annual / annual frequency detection
