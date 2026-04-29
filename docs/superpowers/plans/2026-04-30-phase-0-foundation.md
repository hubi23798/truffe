# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty but real Next.js app reachable on Mac and iPhone, with passkey login, security headers, a `/api/health` endpoint, PWA install support, and a deploy pipeline that ships commits to Fly.io with HTTPS.

**Architecture:** Single Next.js 15 App Router app. Drizzle ORM + Fly Postgres. SimpleWebAuthn for passkeys. One-shot bootstrap token printed to logs for first-passkey enrollment. Server-side session table + `__Host-` cookie. Security headers via Next.js middleware. PWA manifest + minimal Serwist service worker. Tests: Vitest (unit), Playwright (E2E). Deploy: Dockerfile → Fly.io machines via GitHub Actions.

**Tech Stack:** Node 22 LTS · pnpm 9 · TypeScript 5 (strict) · Next.js 15 (App Router) · Tailwind CSS · shadcn/ui · Drizzle ORM · Postgres 16 · @simplewebauthn/server + browser · Vitest · Playwright · Docker · Fly.io · GitHub Actions.

**Reference spec:** [`docs/superpowers/specs/2026-04-29-finance-dashboard-design.md`](../specs/2026-04-29-finance-dashboard-design.md). When this plan and the spec disagree, the spec wins — flag the divergence and update the plan.

**Phase 0 exit criteria (from spec §8 Phase 0):**
- Deploy a commit; log in on Mac with passkey; log in on iPhone (iCloud-synced passkey); see placeholder dashboard; log out.
- All §7.8 headers verifiable via `curl -I`.
- One end-to-end Playwright smoke test: visit → login → assert authenticated.

---

## File structure (created during this phase)

```
.
├── .nvmrc                              # node 22
├── .env.example
├── .editorconfig
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json                     # shadcn/ui config
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.mjs
├── .prettierrc
├── Dockerfile
├── .dockerignore
├── fly.toml
├── public/
│   ├── manifest.webmanifest
│   ├── apple-touch-icon.png             # 180×180
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   ├── icon-maskable-512.png
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── middleware.ts                   # security headers + auth gate
│   ├── env.ts                          # zod-validated env
│   ├── app/
│   │   ├── layout.tsx                  # root layout + theme + manifest link
│   │   ├── globals.css                 # tailwind base + tokens
│   │   ├── page.tsx                    # "/" — auth-gated placeholder dashboard
│   │   ├── login/page.tsx              # passkey login UI
│   │   ├── enroll/page.tsx             # passkey enrollment (post-bootstrap)
│   │   └── api/
│   │       ├── health/route.ts
│   │       └── auth/
│   │           ├── bootstrap/route.ts
│   │           ├── register/options/route.ts
│   │           ├── register/verify/route.ts
│   │           ├── login/options/route.ts
│   │           ├── login/verify/route.ts
│   │           └── logout/route.ts
│   ├── components/
│   │   ├── theme-provider.tsx
│   │   ├── login-form.tsx
│   │   ├── enroll-form.tsx
│   │   └── ui/                         # shadcn primitives (button, input, etc.)
│   └── lib/
│       ├── db/
│       │   ├── client.ts
│       │   ├── schema.ts
│       │   └── migrations/             # generated SQL
│       ├── auth/
│       │   ├── webauthn.ts
│       │   ├── session.ts
│       │   ├── challenges.ts
│       │   └── bootstrap.ts
│       ├── audit.ts
│       └── utils.ts
├── scripts/
│   ├── issue-bootstrap.ts              # CLI: print/refresh bootstrap token
│   └── docker-entrypoint.sh            # migrate then start
├── tests/
│   ├── unit/
│   │   ├── env.test.ts
│   │   ├── session.test.ts
│   │   ├── bootstrap.test.ts
│   │   ├── challenges.test.ts
│   │   └── audit.test.ts
│   └── e2e/
│       ├── smoke.spec.ts
│       └── headers.spec.ts
└── .github/workflows/
    ├── ci.yml
    └── deploy.yml
```

**Boundaries.**
- `src/lib/db/*` is the only module that imports `drizzle-orm` directly. Engines and route handlers depend on a typed repository interface re-exported from there.
- `src/lib/auth/*` is framework-free (no `next/*` imports). Route handlers in `src/app/api/auth/*` are the only place that bridges between Next.js request/response and these helpers.
- `src/env.ts` is imported anywhere typed env access is needed. Do not read `process.env.X` directly in app code.
- `src/middleware.ts` owns security headers and authentication gating. Route handlers do not set their own security headers.

---

## Conventions

**Commits.** One commit per task. Conventional Commits prefixes: `chore`, `feat`, `fix`, `test`, `docs`, `build`, `ci`, `refactor`. Each commit message ends with the `Co-Authored-By` trailer below when an agent (you) authored the change.

**Test-driven where the engine is involved.** Auth helpers are TDD: failing test → minimal impl → passing test → commit. Setup/wiring tasks use a verification step instead of a test (e.g., "run `pnpm dev`, confirm output").

**Run after every step that changes code.** `pnpm typecheck` and `pnpm test:unit -- --run --changed` must both succeed locally before commit. The CI job in Task 25 will enforce this on every push.

**Co-Authored-By trailer (paste verbatim into every commit body):**

```
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Task 1: Project bootstrap (package.json, Node, pnpm)

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Modify: `.gitignore` (already exists; verify)

- [ ] **Step 1: Pin Node version**

Create `.nvmrc`:

```
22
```

- [ ] **Step 2: Verify Node + pnpm available**

Run:

```bash
node --version    # expect v22.x
corepack enable   # ensures pnpm available
pnpm --version    # expect 9.x or later
```

Expected: both versions print without error.

- [ ] **Step 3: Create initial package.json**

Create `package.json`:

```json
{
  "name": "finance-dashboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "bootstrap:issue": "tsx scripts/issue-bootstrap.ts"
  }
}
```

- [ ] **Step 4: Add editorconfig**

Create `.editorconfig`:

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 5: Confirm `.gitignore` excludes `node_modules`, `.next`, `.env`, `revolut.csv`**

Run:

```bash
grep -E '^(node_modules|\.next|\.env|revolut\.csv)' .gitignore
```

Expected: at least these four lines print. If anything missing, add it.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc .editorconfig package.json .gitignore
git commit -m "$(cat <<'EOF'
chore: pin node 22, add editorconfig, scaffold package.json

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TypeScript + Next.js skeleton

**Files:**
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Install Next.js + React + TypeScript**

Run:

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/node @types/react @types/react-dom
```

Expected: all four runtime + four dev deps install without errors.

- [ ] **Step 2: Create `tsconfig.json` with strict mode**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/**/*", "tests/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

- [ ] **Step 4: Create root layout**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Personal finance dashboard and advisor",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create placeholder home page**

Create `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Finance Dashboard</h1>
        <p className="mt-2 text-sm opacity-70">Phase 0 placeholder.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create `globals.css` (Tailwind comes in Task 3)**

Create `src/app/globals.css`:

```css
:root {
  color-scheme: light dark;
}

html,
body {
  height: 100%;
}
```

- [ ] **Step 7: Run dev server, confirm placeholder renders**

Run:

```bash
pnpm dev
```

Expected: server starts on `http://localhost:3000`. Visit in browser; see "Finance Dashboard / Phase 0 placeholder." Stop with Ctrl-C.

- [ ] **Step 8: Run `pnpm typecheck`**

Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add tsconfig.json next.config.ts src/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: scaffold next.js app router with strict typescript

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tailwind CSS + design tokens

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Install Tailwind**

Run:

```bash
pnpm add -D tailwindcss@latest postcss autoprefixer @tailwindcss/postcss
```

- [ ] **Step 2: Create `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "hsl(var(--surface))",
        "fg-default": "hsl(var(--fg-default))",
        "fg-muted": "hsl(var(--fg-muted))",
        "border-subtle": "hsl(var(--border-subtle))",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --surface: 0 0% 100%;
    --fg-default: 240 10% 4%;
    --fg-muted: 240 4% 46%;
    --border-subtle: 240 6% 90%;
  }

  .dark {
    --surface: 240 10% 4%;
    --fg-default: 0 0% 98%;
    --fg-muted: 240 5% 65%;
    --border-subtle: 240 4% 16%;
  }

  html,
  body {
    height: 100%;
  }

  body {
    @apply bg-surface text-fg-default antialiased;
  }
}
```

- [ ] **Step 5: Verify Tailwind compiles**

Run `pnpm dev`; visit `http://localhost:3000`. Confirm background is white in light mode and dark in dark mode (toggle macOS appearance to test).

Expected: no console errors; styles apply.

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts postcss.config.mjs src/app/globals.css package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add tailwind css with light/dark tokens

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: ESLint + Prettier

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Install lint/format tooling**

Run:

```bash
pnpm add -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
```

- [ ] **Step 2: Create `eslint.config.mjs`**

```js
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next/*"],
              importNames: [],
              message: "Reserved — only allowed in src/app/** and src/middleware.ts",
            },
          ],
        },
      ],
    },
  },
];
```

(The `no-restricted-imports` rule is a guardrail to keep the domain layer framework-free in later phases. Tighten it then; it's lenient in Phase 0.)

- [ ] **Step 3: Install `@eslint/eslintrc` (peer for FlatCompat)**

```bash
pnpm add -D @eslint/eslintrc
```

- [ ] **Step 4: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 5: Create `.prettierignore`**

```
.next
node_modules
pnpm-lock.yaml
public
src/lib/db/migrations
```

- [ ] **Step 6: Run lint + format**

```bash
pnpm format
pnpm lint
```

Expected: format rewrites files; lint reports 0 errors.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore package.json pnpm-lock.yaml src/
git commit -m "$(cat <<'EOF'
build: add eslint and prettier with tailwind plugin

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Vitest setup + first unit test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/unit/sanity.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/sanity.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run the test**

```bash
pnpm test:unit -- --run
```

Expected: 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
test: add vitest with one sanity test

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Validated environment loader

**Files:**
- Create: `.env.example`
- Create: `src/env.ts`
- Create: `tests/unit/env.test.ts`

- [ ] **Step 1: Install zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/env.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { loadEnv } from "@/env";

describe("loadEnv", () => {
  it("accepts valid env", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/finance",
      RP_ID: "localhost",
      RP_NAME: "Finance Dashboard",
      ORIGIN: "http://localhost:3000",
      SESSION_COOKIE_NAME: "__Host-session",
      NODE_ENV: "test",
    });
    expect(env.RP_ID).toBe("localhost");
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() =>
      loadEnv({
        RP_ID: "localhost",
        RP_NAME: "Finance Dashboard",
        ORIGIN: "http://localhost:3000",
        SESSION_COOKIE_NAME: "__Host-session",
        NODE_ENV: "test",
      } as Record<string, string>),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects non-URL ORIGIN", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgres://u:p@localhost:5432/finance",
        RP_ID: "localhost",
        RP_NAME: "Finance Dashboard",
        ORIGIN: "not-a-url",
        SESSION_COOKIE_NAME: "__Host-session",
        NODE_ENV: "test",
      }),
    ).toThrow(/ORIGIN/);
  });
});
```

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm test:unit -- --run tests/unit/env.test.ts
```

Expected: fails with `Cannot find module '@/env'`.

- [ ] **Step 4: Implement `src/env.ts`**

```typescript
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")),
  RP_ID: z.string().min(1),
  RP_NAME: z.string().min(1),
  ORIGIN: z.string().url(),
  SESSION_COOKIE_NAME: z.string().default("__Host-session"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADVISOR_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(200_000),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
pnpm test:unit -- --run tests/unit/env.test.ts
```

Expected: 3 tests passing.

- [ ] **Step 6: Create `.env.example`**

```
# Postgres connection string (Fly Postgres provides one in production)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance

# WebAuthn relying party
RP_ID=localhost
RP_NAME=Finance Dashboard
ORIGIN=http://localhost:3000

# Session
SESSION_COOKIE_NAME=__Host-session

# Advisor cost ceiling (tokens/day, totalled across input + output)
ADVISOR_DAILY_TOKEN_BUDGET=200000
```

- [ ] **Step 7: Commit**

```bash
git add src/env.ts tests/unit/env.test.ts .env.example package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(env): add zod-validated environment loader

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Drizzle ORM + database client

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/schema.ts` (empty stubs filled in Task 8)

- [ ] **Step 1: Install Drizzle + Postgres driver**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/finance",
  },
  strict: true,
  verbose: true,
} satisfies Config;
```

- [ ] **Step 3: Create empty schema file**

Create `src/lib/db/schema.ts`:

```typescript
// Tables defined in Task 8.
// This file is the single source of truth for Drizzle schema.
export {};
```

- [ ] **Step 4: Create db client**

Create `src/lib/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!dbInstance) {
    queryClient = postgres(env().DATABASE_URL, { max: 5 });
    dbInstance = drizzle(queryClient, { schema });
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts src/lib/db/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(db): add drizzle config and lazy postgres client

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Define Phase-0 schema (`user`, `passkey_credential`, `session`, `audit_log`)

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Replace `src/lib/db/schema.ts`**

```typescript
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

export const riskToleranceEnum = pgEnum("risk_tolerance", [
  "conservative",
  "moderate",
  "aggressive",
]);

export const auditActorEnum = pgEnum("audit_actor", ["user", "advisor", "system", "cron"]);

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
  (t) => ({
    credentialIdUnique: uniqueIndex("passkey_credential_credential_id_unique").on(t.credentialId),
  }),
);

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

export const challenge = pgTable("challenge", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  purpose: text("purpose").notNull(), // 'register' | 'login'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumed: boolean("consumed").notNull().default(false),
});

export const bootstrapToken = pgTable("bootstrap_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

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

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type PasskeyCredential = typeof passkeyCredential.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Challenge = typeof challenge.$inferSelect;
export type BootstrapToken = typeof bootstrapToken.$inferSelect;
```

Note: `challenge` and `bootstrap_token` are added now to support Phase-0 auth, even though they were not enumerated in spec §2.1. They are infrastructure tables for the auth flow itself, not part of the user-visible data model — fold a sentence about them into the spec under §2.1 in a follow-up.

- [ ] **Step 2: Generate migration**

Run a local Postgres first (Docker):

```bash
docker run --rm -d --name finance-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finance -p 5432:5432 postgres:16-alpine
```

Then generate:

```bash
pnpm db:generate
```

Expected: a new SQL file under `src/lib/db/migrations/0000_*.sql` is created.

- [ ] **Step 3: Apply migration**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance pnpm db:migrate
```

Expected: tables created. Verify with:

```bash
docker exec finance-pg psql -U postgres -d finance -c '\dt'
```

Expected output lists all 6 tables (`user`, `passkey_credential`, `session`, `challenge`, `bootstrap_token`, `audit_log`).

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add phase-0 schema (user, passkey, session, challenge, bootstrap, audit)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Stop the local Postgres container** (only if you don't want it running)

```bash
docker stop finance-pg
```

(Restart with `docker start finance-pg` when running tests later.)

---

## Task 9: Audit log helper

**Files:**
- Create: `src/lib/audit.ts`
- Create: `tests/unit/audit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/audit.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { recordAudit } from "@/lib/audit";

describe("recordAudit", () => {
  it("inserts a row with required fields", async () => {
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    const fakeDb = { insert: insertMock } as unknown as Parameters<typeof recordAudit>[0];

    await recordAudit(fakeDb, {
      actor: "user",
      action: "session.create",
      userId: "00000000-0000-0000-0000-000000000001",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const valuesArg = insertMock.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(valuesArg.actor).toBe("user");
    expect(valuesArg.action).toBe("session.create");
    expect(valuesArg.userId).toBe("00000000-0000-0000-0000-000000000001");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test:unit -- --run tests/unit/audit.test.ts
```

Expected: fails with `Cannot find module '@/lib/audit'`.

- [ ] **Step 3: Implement `src/lib/audit.ts`**

```typescript
import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

type Actor = "user" | "advisor" | "system" | "cron";

export interface AuditEntry {
  actor: Actor;
  action: string;
  userId?: string;
  targetTable?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    userId: entry.userId,
    targetTable: entry.targetTable,
    targetId: entry.targetId,
    before: entry.before as never,
    after: entry.after as never,
  });
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test:unit -- --run tests/unit/audit.test.ts
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts tests/unit/audit.test.ts
git commit -m "$(cat <<'EOF'
feat(audit): add audit log helper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Challenge store (short-TTL)

**Files:**
- Create: `src/lib/auth/challenges.ts`
- Create: `tests/unit/challenges.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/challenges.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { issueChallenge, consumeChallenge, CHALLENGE_TTL_MS } from "@/lib/auth/challenges";

const realDateNow = Date.now;

describe("challenges", () => {
  beforeEach(() => {
    Date.now = realDateNow;
  });

  it("issueChallenge inserts with the provided purpose and returns id+challenge+expiresAt", async () => {
    const inserted: Record<string, unknown>[] = [];
    const fakeDb = {
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          returning: () => Promise.resolve([{ id: "cid", challenge: v.challenge, expiresAt: v.expiresAt }]),
        }),
      }),
    } as never;

    const out = await issueChallenge(fakeDb, "register", "user-1");
    expect(out.id).toBe("cid");
    expect(typeof out.challenge).toBe("string");
    expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("consumeChallenge marks consumed and rejects expired or already-consumed", async () => {
    const now = new Date();
    const fakeRow = {
      id: "cid",
      challenge: "abc",
      purpose: "register",
      consumed: false,
      expiresAt: new Date(now.getTime() + 60_000),
      userId: null,
    };
    const updateCalls: unknown[] = [];
    const fakeDb = {
      query: { challenge: { findFirst: vi.fn().mockResolvedValue(fakeRow) } },
      update: () => ({
        set: (v: unknown) => ({
          where: () => {
            updateCalls.push(v);
            return Promise.resolve();
          },
        }),
      }),
    } as never;

    const ok = await consumeChallenge(fakeDb, "cid", "register");
    expect(ok).toEqual({ challenge: "abc", userId: null });
    expect(updateCalls).toHaveLength(1);
  });

  it("CHALLENGE_TTL_MS is 5 minutes", () => {
    expect(CHALLENGE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test:unit -- --run tests/unit/challenges.test.ts
```

Expected: fails with module-not-found.

- [ ] **Step 3: Implement `src/lib/auth/challenges.ts`**

```typescript
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { challenge as challengeTable } from "@/lib/db/schema";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type ChallengePurpose = "register" | "login";

export interface IssuedChallenge {
  id: string;
  challenge: string;
  expiresAt: Date;
}

export async function issueChallenge(
  db: Db,
  purpose: ChallengePurpose,
  userId?: string,
): Promise<IssuedChallenge> {
  const challenge = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const [row] = await db
    .insert(challengeTable)
    .values({ challenge, purpose, expiresAt, userId })
    .returning({ id: challengeTable.id, challenge: challengeTable.challenge, expiresAt: challengeTable.expiresAt });
  if (!row) throw new Error("Failed to issue challenge");
  return { id: row.id, challenge: row.challenge, expiresAt: row.expiresAt };
}

export async function consumeChallenge(
  db: Db,
  challengeId: string,
  expectedPurpose: ChallengePurpose,
): Promise<{ challenge: string; userId: string | null } | null> {
  const row = await db.query.challenge.findFirst({
    where: eq(challengeTable.id, challengeId),
  });
  if (!row) return null;
  if (row.consumed) return null;
  if (row.purpose !== expectedPurpose) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.update(challengeTable).set({ consumed: true }).where(eq(challengeTable.id, challengeId));
  return { challenge: row.challenge, userId: row.userId };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test:unit -- --run tests/unit/challenges.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/challenges.ts tests/unit/challenges.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add short-ttl challenge store

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Session model (create / read / destroy)

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `tests/unit/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/session.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { SESSION_SLIDING_TTL_MS, SESSION_HARD_TTL_MS, isExpired } from "@/lib/auth/session";

describe("session ttl", () => {
  it("sliding TTL is 30 days", () => {
    expect(SESSION_SLIDING_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("hard TTL is 90 days", () => {
    expect(SESSION_HARD_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("isExpired returns true for sessions past expiresAt", () => {
    const expired = { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 1000) };
    expect(isExpired(expired)).toBe(true);
  });

  it("isExpired returns true for sessions older than hard cap, even if expiresAt is in the future", () => {
    const tooOld = {
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - SESSION_HARD_TTL_MS - 1),
    };
    expect(isExpired(tooOld)).toBe(true);
  });

  it("isExpired returns false for a fresh, unexpired session", () => {
    const ok = {
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now() - 60_000),
    };
    expect(isExpired(ok)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test:unit -- --run tests/unit/session.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement `src/lib/auth/session.ts`**

```typescript
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { session } from "@/lib/db/schema";

export const SESSION_SLIDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_HARD_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface SessionTtlRow {
  expiresAt: Date;
  createdAt: Date;
}

export function isExpired(s: SessionTtlRow, now: Date = new Date()): boolean {
  if (s.expiresAt.getTime() <= now.getTime()) return true;
  if (now.getTime() - s.createdAt.getTime() >= SESSION_HARD_TTL_MS) return true;
  return false;
}

export async function createSession(
  db: Db,
  userId: string,
  userAgent: string | undefined,
): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_SLIDING_TTL_MS);
  // One session per user: invalidate previous sessions first.
  await db.delete(session).where(eq(session.userId, userId));
  const [row] = await db
    .insert(session)
    .values({ userId, expiresAt, userAgent })
    .returning({ id: session.id, expiresAt: session.expiresAt });
  if (!row) throw new Error("Failed to create session");
  return row;
}

export async function readSession(db: Db, sessionId: string) {
  const row = await db.query.session.findFirst({ where: eq(session.id, sessionId) });
  if (!row) return null;
  if (isExpired(row)) return null;
  // Sliding refresh.
  const newExpires = new Date(Date.now() + SESSION_SLIDING_TTL_MS);
  const hardCap = new Date(row.createdAt.getTime() + SESSION_HARD_TTL_MS);
  await db
    .update(session)
    .set({
      lastSeenAt: new Date(),
      expiresAt: newExpires < hardCap ? newExpires : hardCap,
    })
    .where(eq(session.id, sessionId));
  return row;
}

export async function destroySession(db: Db, sessionId: string): Promise<void> {
  await db.delete(session).where(eq(session.id, sessionId));
}

export async function destroyAllSessionsForUser(db: Db, userId: string): Promise<void> {
  await db.delete(session).where(eq(session.userId, userId));
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test:unit -- --run tests/unit/session.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts tests/unit/session.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add session create/read/destroy with sliding TTL and 90-day hard cap

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Bootstrap token (issue + redeem, single-use)

**Files:**
- Create: `src/lib/auth/bootstrap.ts`
- Create: `scripts/issue-bootstrap.ts`
- Create: `tests/unit/bootstrap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/bootstrap.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { hashToken, verifyToken, BOOTSTRAP_TOKEN_TTL_MS } from "@/lib/auth/bootstrap";

describe("bootstrap token", () => {
  it("hashToken is deterministic and 64 hex chars", () => {
    const a = hashToken("the-token");
    const b = hashToken("the-token");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(a)).toBe(true);
  });

  it("verifyToken rejects mismatch", () => {
    const hash = hashToken("good-token");
    expect(verifyToken("bad-token", hash)).toBe(false);
    expect(verifyToken("good-token", hash)).toBe(true);
  });

  it("token TTL is 1 hour", () => {
    expect(BOOTSTRAP_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test:unit -- --run tests/unit/bootstrap.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement `src/lib/auth/bootstrap.ts`**

```typescript
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { bootstrapToken } from "@/lib/db/schema";

export const BOOTSTRAP_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyToken(provided: string, knownHash: string): boolean {
  const a = Buffer.from(hashToken(provided), "hex");
  const b = Buffer.from(knownHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function issueBootstrapToken(db: Db): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + BOOTSTRAP_TOKEN_TTL_MS);
  await db.insert(bootstrapToken).values({ tokenHash: hashToken(token), expiresAt });
  return token;
}

export async function redeemBootstrapToken(db: Db, provided: string): Promise<boolean> {
  // Find any unconsumed, unexpired token whose hash matches.
  const candidates = await db
    .select()
    .from(bootstrapToken)
    .where(and(isNull(bootstrapToken.consumedAt)));
  const now = Date.now();
  for (const row of candidates) {
    if (row.expiresAt.getTime() < now) continue;
    if (verifyToken(provided, row.tokenHash)) {
      await db
        .update(bootstrapToken)
        .set({ consumedAt: new Date() })
        .where(eq(bootstrapToken.id, row.id));
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Implement `scripts/issue-bootstrap.ts`**

```typescript
import { getDb } from "@/lib/db/client";
import { issueBootstrapToken, BOOTSTRAP_TOKEN_TTL_MS } from "@/lib/auth/bootstrap";

async function main() {
  const db = getDb();
  const token = await issueBootstrapToken(db);
  const minutes = Math.round(BOOTSTRAP_TOKEN_TTL_MS / 60_000);
  process.stdout.write(
    `Bootstrap token (single-use, expires in ${minutes} min):\n${token}\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Failed to issue bootstrap token: ${String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 5: Install `tsx` to run the script**

```bash
pnpm add -D tsx
```

- [ ] **Step 6: Run unit test, expect pass**

```bash
pnpm test:unit -- --run tests/unit/bootstrap.test.ts
```

Expected: 3 passing.

- [ ] **Step 7: Smoke-test the script against local Postgres**

(Ensure `docker start finance-pg` is up.)

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance \
RP_ID=localhost RP_NAME=Finance ORIGIN=http://localhost:3000 \
SESSION_COOKIE_NAME=__Host-session NODE_ENV=development \
pnpm bootstrap:issue
```

Expected: a token line is printed. Confirm a row appeared:

```bash
docker exec finance-pg psql -U postgres -d finance -c 'SELECT id, expires_at FROM bootstrap_token;'
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/bootstrap.ts scripts/issue-bootstrap.ts tests/unit/bootstrap.test.ts package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(auth): add bootstrap token (issue/redeem, single-use, 1h TTL)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: WebAuthn helpers (registration + authentication wrappers)

**Files:**
- Create: `src/lib/auth/webauthn.ts`

- [ ] **Step 1: Install SimpleWebAuthn**

```bash
pnpm add @simplewebauthn/server @simplewebauthn/browser
```

- [ ] **Step 2: Implement `src/lib/auth/webauthn.ts`**

```typescript
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";
import { env } from "@/env";

export async function buildRegistrationOptions(
  db: Db,
  userId: string,
  userName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const e = env();
  const existing = await db.query.passkeyCredential.findMany({
    where: eq(passkeyCredential.userId, userId),
  });
  return generateRegistrationOptions({
    rpName: e.RP_NAME,
    rpID: e.RP_ID,
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  });
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const e = env();
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: e.ORIGIN,
    expectedRPID: e.RP_ID,
    requireUserVerification: true,
  });
}

export async function buildAuthenticationOptions(
  db: Db,
  userId?: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const e = env();
  const allow = userId
    ? (
        await db.query.passkeyCredential.findMany({
          where: eq(passkeyCredential.userId, userId),
        })
      ).map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      }))
    : undefined;
  return generateAuthenticationOptions({
    rpID: e.RP_ID,
    userVerification: "required",
    allowCredentials: allow,
  });
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: { id: string; publicKey: Uint8Array; counter: number },
) {
  const e = env();
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: e.ORIGIN,
    expectedRPID: e.RP_ID,
    credential,
    requireUserVerification: true,
  });
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors. (If `AuthenticatorTransport` import errors, change the `transports` field cast to `string[] | undefined`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/webauthn.ts package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(auth): add SimpleWebAuthn wrappers for registration/authentication

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Bootstrap redemption route + cookie helper

**Files:**
- Create: `src/app/api/auth/bootstrap/route.ts`
- Create: `src/lib/auth/cookies.ts`

- [ ] **Step 1: Implement `src/lib/auth/cookies.ts`**

```typescript
import { cookies } from "next/headers";
import { env } from "@/env";

const ENROLLMENT_COOKIE = "__Host-enrollment";
const ENROLLMENT_TTL_S = 10 * 60;

export async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: env().SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(env().SESSION_COOKIE_NAME);
}

export async function readSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
}

export async function setEnrollmentCookie(value: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ENROLLMENT_COOKIE,
    value,
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ENROLLMENT_TTL_S,
  });
}

export async function readEnrollmentCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ENROLLMENT_COOKIE)?.value;
}

export async function clearEnrollmentCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ENROLLMENT_COOKIE);
}
```

- [ ] **Step 2: Implement `src/app/api/auth/bootstrap/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { redeemBootstrapToken } from "@/lib/auth/bootstrap";
import { setEnrollmentCookie } from "@/lib/auth/cookies";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "node:crypto";

const bodySchema = z.object({ token: z.string().min(1).max(256) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const db = getDb();
  const ok = await redeemBootstrapToken(db, parsed.data.token);
  if (!ok) {
    await recordAudit(db, { actor: "system", action: "bootstrap.redeem.failed" });
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  // Mint a short-lived enrollment cookie that the registration ceremony will require.
  const enrollmentNonce = randomBytes(16).toString("base64url");
  await setEnrollmentCookie(enrollmentNonce);
  await recordAudit(db, { actor: "system", action: "bootstrap.redeem.ok" });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/cookies.ts src/app/api/auth/bootstrap/
git commit -m "$(cat <<'EOF'
feat(auth): add bootstrap redemption route + cookie helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Registration routes (options + verify)

**Files:**
- Create: `src/app/api/auth/register/options/route.ts`
- Create: `src/app/api/auth/register/verify/route.ts`

- [ ] **Step 1: Implement `src/app/api/auth/register/options/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { user as userTable } from "@/lib/db/schema";
import { buildRegistrationOptions } from "@/lib/auth/webauthn";
import { issueChallenge } from "@/lib/auth/challenges";
import { readEnrollmentCookie } from "@/lib/auth/cookies";

export async function POST() {
  const enrollment = await readEnrollmentCookie();
  if (!enrollment) {
    return NextResponse.json({ error: "enrollment_not_authorized" }, { status: 401 });
  }
  const db = getDb();
  // Phase 0: at most one user. Find or create.
  const existing = await db.query.user.findFirst();
  let userId: string;
  let userName: string;
  if (existing) {
    userId = existing.id;
    userName = `user-${existing.id.slice(0, 8)}`;
  } else {
    const [created] = await db.insert(userTable).values({}).returning({ id: userTable.id });
    if (!created) {
      return NextResponse.json({ error: "user_create_failed" }, { status: 500 });
    }
    userId = created.id;
    userName = `user-${userId.slice(0, 8)}`;
  }
  const options = await buildRegistrationOptions(db, userId, userName);
  const issued = await issueChallenge(db, "register", userId);
  return NextResponse.json({ options, challengeId: issued.id });
}
```

- [ ] **Step 2: Implement `src/app/api/auth/register/verify/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";
import { verifyRegistration } from "@/lib/auth/webauthn";
import { consumeChallenge } from "@/lib/auth/challenges";
import { recordAudit } from "@/lib/audit";
import { clearEnrollmentCookie, setSessionCookie } from "@/lib/auth/cookies";
import { createSession } from "@/lib/auth/session";

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.unknown(),
  nickname: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const db = getDb();
  const consumed = await consumeChallenge(db, parsed.data.challengeId, "register");
  if (!consumed || !consumed.userId) {
    return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
  }
  const result = await verifyRegistration(
    parsed.data.response as never,
    consumed.challenge,
  );
  if (!result.verified || !result.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 401 });
  }
  const reg = result.registrationInfo;
  await db.insert(passkeyCredential).values({
    userId: consumed.userId,
    credentialId: reg.credential.id,
    publicKey: Buffer.from(reg.credential.publicKey).toString("base64"),
    signCount: Number(reg.credential.counter ?? 0),
    transports: (parsed.data.response as { response?: { transports?: string[] } })?.response
      ?.transports ?? [],
    nickname: parsed.data.nickname,
  });
  await recordAudit(db, {
    actor: "user",
    action: "passkey.register",
    userId: consumed.userId,
  });
  // Issue a session and clear the enrollment cookie.
  await clearEnrollmentCookie();
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sess = await createSession(db, consumed.userId, userAgent);
  await setSessionCookie(sess.id, sess.expiresAt);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors. (If SimpleWebAuthn types complain about `credential.publicKey` vs `credentialPublicKey`, follow the upstream API for the version installed; the property name was renamed across major versions of `@simplewebauthn/server`. Use the form that matches the installed version.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/register/
git commit -m "$(cat <<'EOF'
feat(auth): add passkey registration routes (options + verify)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Login routes (options + verify) and logout

**Files:**
- Create: `src/app/api/auth/login/options/route.ts`
- Create: `src/app/api/auth/login/verify/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Implement `src/app/api/auth/login/options/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { buildAuthenticationOptions } from "@/lib/auth/webauthn";
import { issueChallenge } from "@/lib/auth/challenges";

export async function POST() {
  const db = getDb();
  const options = await buildAuthenticationOptions(db);
  const issued = await issueChallenge(db, "login");
  return NextResponse.json({ options, challengeId: issued.id });
}
```

- [ ] **Step 2: Implement `src/app/api/auth/login/verify/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { passkeyCredential } from "@/lib/db/schema";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { consumeChallenge } from "@/lib/auth/challenges";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";
import { recordAudit } from "@/lib/audit";

const bodySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.unknown().optional(),
  }),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const db = getDb();
  const consumed = await consumeChallenge(db, parsed.data.challengeId, "login");
  if (!consumed) {
    return NextResponse.json({ error: "invalid_challenge" }, { status: 401 });
  }
  const credentialId = parsed.data.response.id;
  const cred = await db.query.passkeyCredential.findFirst({
    where: eq(passkeyCredential.credentialId, credentialId),
  });
  if (!cred) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 401 });
  }
  const result = await verifyAuthentication(parsed.data.response as never, consumed.challenge, {
    id: cred.credentialId,
    publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64")),
    counter: cred.signCount,
  });
  if (!result.verified) {
    await recordAudit(db, {
      actor: "user",
      action: "login.failed",
      userId: cred.userId,
    });
    return NextResponse.json({ error: "verification_failed" }, { status: 401 });
  }
  await db
    .update(passkeyCredential)
    .set({
      signCount: Number(result.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    })
    .where(eq(passkeyCredential.id, cred.id));
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sess = await createSession(db, cred.userId, userAgent);
  await setSessionCookie(sess.id, sess.expiresAt);
  await recordAudit(db, { actor: "user", action: "login.ok", userId: cred.userId });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { destroySession } from "@/lib/auth/session";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  const db = getDb();
  const sid = await readSessionCookie();
  if (sid) {
    await destroySession(db, sid);
    await recordAudit(db, { actor: "user", action: "logout" });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/login/ src/app/api/auth/logout/
git commit -m "$(cat <<'EOF'
feat(auth): add passkey login + logout routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Health endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Implement**

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { ok: true, version: process.env.GIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Verify**

Run `pnpm dev`. In another terminal:

```bash
curl -i http://localhost:3000/api/health
```

Expected: `HTTP/1.1 200 OK`, body `{"ok":true,"version":"dev"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/
git commit -m "$(cat <<'EOF'
feat: add /api/health endpoint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Middleware — security headers + auth gate

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement**

```typescript
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/enroll",
  "/api/health",
  "/api/auth/bootstrap",
  "/api/auth/register/options",
  "/api/auth/register/verify",
  "/api/auth/login/options",
  "/api/auth/login/verify",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/robots.txt",
];

const STATIC_PREFIXES = ["/_next/", "/static/"];

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.includes(pathname);
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // Tailwind injects styles; tighten with nonces in Phase 4.
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.anthropic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "__Host-session";
  const sessionId = req.cookies.get(cookieName)?.value;

  // Public routes: pass through with security headers only.
  if (isPublic(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Authenticated routes: require a session cookie, redirect to /login otherwise.
  if (!sessionId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
```

Note: middleware can only validate the *presence* of the cookie (Edge runtime; no Postgres here). The route handlers re-validate against the DB. This is correct: middleware is a fast gate, the DB lookup happens inside route handlers and Server Components.

- [ ] **Step 2: Verify headers**

Run `pnpm dev`. Then:

```bash
curl -I http://localhost:3000/api/health
```

Expected response includes:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy: ...`

- [ ] **Step 3: Verify auth gate**

```bash
curl -I http://localhost:3000/
```

Expected: `HTTP/1.1 307 Temporary Redirect` with `Location: /login?from=%2F`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "$(cat <<'EOF'
feat(security): add middleware for security headers and auth gate

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: shadcn/ui init + minimal components

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/alert.tsx`

- [ ] **Step 1: Install shadcn/ui CLI + dependencies**

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D @types/node
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 4: Add the five primitives via shadcn CLI**

```bash
pnpm dlx shadcn@latest add button input label card alert
```

If interactive prompts appear, accept defaults. Files land in `src/components/ui/`.

- [ ] **Step 5: Verify**

```bash
pnpm typecheck
```

Expected: 0 errors. If shadcn generated styles that don't match the tokens defined in Task 3, leave them as-is for Phase 0 — alignment to the token system is a Phase 4 polish item.

- [ ] **Step 6: Commit**

```bash
git add components.json src/components/ src/lib/utils.ts src/app/globals.css package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(ui): init shadcn/ui with button, input, label, card, alert

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Login + enrollment pages + auth-gated home

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/app/enroll/page.tsx`
- Create: `src/components/login-form.tsx`
- Create: `src/components/enroll-form.tsx`
- Create: `src/components/logout-button.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { readSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { env } from "@/env";

export default async function HomePage() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) redirect("/login");
  const sess = await readSession(getDb(), sid);
  if (!sess) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border-subtle p-6">
        <div>
          <h1 className="text-2xl font-semibold">Finance Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Phase 0 — you are signed in. The dashboard arrives in Phase 1.
          </p>
        </div>
        <LogoutButton />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Implement `src/components/logout-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/enroll/page.tsx`**

```tsx
import { EnrollForm } from "@/components/enroll-form";

export default function EnrollPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EnrollForm />
    </main>
  );
}
```

- [ ] **Step 5: Implement `src/components/login-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      const optsRes = await fetch("/api/auth/login/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start login");
      const { options, challengeId } = await optsRes.json();
      const response = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Login failed");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Sign-in error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={onLogin} disabled={busy} className="w-full">
          {busy ? "Authenticating…" : "Sign in with passkey"}
        </Button>
        <p className="text-sm text-fg-muted">
          First time? <a className="underline" href="/enroll">Enroll a passkey using a bootstrap token</a>.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Implement `src/components/enroll-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function EnrollForm() {
  const [token, setToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRedeem() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Token invalid");
      }
      setRedeemed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onEnroll() {
    setError(null);
    setBusy(true);
    try {
      const optsRes = await fetch("/api/auth/register/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start enrollment");
      const { options, challengeId } = await optsRes.json();
      const response = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response, nickname: nickname || undefined }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Enrollment failed");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Enroll a passkey</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!redeemed ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="token">Bootstrap token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="paste single-use token from server logs"
                autoComplete="off"
              />
            </div>
            <Button onClick={onRedeem} disabled={busy || !token.trim()} className="w-full">
              {busy ? "Validating…" : "Continue"}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="nickname">Device nickname (optional)</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. iPhone"
              />
            </div>
            <Button onClick={onEnroll} disabled={busy} className="w-full">
              {busy ? "Enrolling…" : "Create passkey"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Manual smoke (full local flow)**

(Local Postgres up; `pnpm dev` running.)

In another terminal:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance \
RP_ID=localhost RP_NAME="Finance" ORIGIN=http://localhost:3000 \
SESSION_COOKIE_NAME=__Host-session NODE_ENV=development \
pnpm bootstrap:issue
```

Copy the printed token. In the browser:

1. Visit `http://localhost:3000/` → redirected to `/login`.
2. Click *Enroll a passkey* link → `/enroll`.
3. Paste the token → click *Continue*.
4. Click *Create passkey* → complete the WebAuthn ceremony (Touch ID / device PIN).
5. You are redirected to `/` and see the signed-in placeholder.
6. Click *Sign out* → back to `/login`.
7. Click *Sign in with passkey* → choose your credential → redirected to `/`.

Note: For local dev `__Host-` cookies require HTTPS in production, but the cookie helper in Task 14 sets `secure: true` only in production, so plain HTTP at `localhost` works in dev — the *name* `__Host-session` is fine but the strict prefix rules apply only when `Secure` is set.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx src/app/login/ src/app/enroll/ src/components/
git commit -m "$(cat <<'EOF'
feat(ui): add login, enroll, and auth-gated home pages

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: PWA manifest + icons + Apple meta tags

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/robots.txt`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-192.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon.ico`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Generate placeholder icons**

For Phase 0, use a single-color square as the placeholder (replace with real art in Phase 4). Run:

```bash
mkdir -p public
# Requires ImageMagick. If unavailable, substitute any 192x192/512x512/180x180 PNGs you like.
magick -size 512x512 xc:'#0a0a0a' -fill white -gravity center -font 'Helvetica' -pointsize 240 -annotate 0 'F' public/icon-512.png
magick public/icon-512.png -resize 192x192 public/icon-192.png
magick public/icon-512.png -resize 180x180 public/apple-touch-icon.png
cp public/icon-192.png public/icon-maskable-192.png
cp public/icon-512.png public/icon-maskable-512.png
magick public/icon-192.png -resize 32x32 public/favicon.ico
```

If `magick` is unavailable, drop in any matching-size PNGs by hand. The icons must exist at these paths for the manifest to validate.

- [ ] **Step 2: Create `public/manifest.webmanifest`**

```json
{
  "name": "Finance Dashboard",
  "short_name": "Finance",
  "description": "Personal finance dashboard and advisor",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 3: Create `public/robots.txt`**

```
User-agent: *
Disallow: /
```

(Single-user app on the public internet — no need to be indexed.)

- [ ] **Step 4: Add manifest + Apple meta tags to root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Personal finance dashboard and advisor",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Finance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-surface text-fg-default antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify manifest**

Run `pnpm dev`. In another terminal:

```bash
curl -s http://localhost:3000/manifest.webmanifest | head
```

Expected: the JSON is served. Open Chrome DevTools → Application → Manifest on `http://localhost:3000/login`. Expected: parsed without errors, icons present.

- [ ] **Step 6: Commit**

```bash
git add public/ src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(pwa): add web app manifest, icons, and apple meta tags

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Theme provider (light/dark)

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install next-themes**

```bash
pnpm add next-themes
```

- [ ] **Step 2: Create `src/components/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Wrap app in `src/app/layout.tsx`**

Modify the body of the layout:

```tsx
        <ThemeProvider>
          {children}
        </ThemeProvider>
```

…and add the import: `import { ThemeProvider } from "@/components/theme-provider";`.

The full `RootLayout` body becomes:

```tsx
return (
  <html lang="en" suppressHydrationWarning>
    <body className="bg-surface text-fg-default antialiased">
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>
);
```

- [ ] **Step 4: Verify**

Run `pnpm dev`. Toggle macOS appearance between light and dark. Expected: page background tracks the system setting (no manual toggle UI yet — that's Phase 4 polish).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme-provider.tsx src/app/layout.tsx package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(ui): add next-themes provider for light/dark following system

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: Playwright E2E — security headers + smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/headers.spec.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
```

- [ ] **Step 3: Write headers test**

Create `tests/e2e/headers.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

const REQUIRED_HEADERS = [
  ["strict-transport-security", /max-age=63072000.*includeSubDomains.*preload/i],
  ["x-content-type-options", /nosniff/i],
  ["referrer-policy", /strict-origin-when-cross-origin/i],
  ["x-frame-options", /DENY/i],
  ["permissions-policy", /camera=\(\)/i],
  ["content-security-policy", /default-src 'self'/i],
] as const;

test("security headers present on /api/health", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  for (const [name, pattern] of REQUIRED_HEADERS) {
    const value = res.headers()[name];
    expect(value, `expected header ${name}`).toBeDefined();
    expect(value).toMatch(pattern);
  }
});
```

- [ ] **Step 4: Write smoke test**

Create `tests/e2e/smoke.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test("unauthenticated home redirects to /login", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login(\?from=)?/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("login page renders enroll link", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /enroll a passkey/i })).toBeVisible();
});
```

These two tests do not exercise WebAuthn (it requires a virtual authenticator that is awkward to set up in Phase 0). They cover the auth-gating + UI rendering. A WebAuthn-virtual-authenticator E2E test lands in Phase 4 polish.

- [ ] **Step 5: Run E2E**

(Local Postgres up.)

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance \
RP_ID=localhost RP_NAME=Finance ORIGIN=http://localhost:3000 \
SESSION_COOKIE_NAME=__Host-session NODE_ENV=development \
pnpm test:e2e
```

Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
test(e2e): add security headers and smoke test

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Dockerfile + entrypoint

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `scripts/docker-entrypoint.sh`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.env*
!.env.example
revolut.csv
*.csv
.git
.github
.vscode
.idea
tests
playwright-report
coverage
```

- [ ] **Step 2: Create `scripts/docker-entrypoint.sh`**

```sh
#!/bin/sh
set -eu

if [ -n "${RUN_MIGRATIONS:-}" ]; then
  echo "Running migrations..."
  node /app/node_modules/drizzle-kit/bin.cjs migrate
fi

exec node /app/server.js
```

Make it executable when committing:

```bash
chmod +x scripts/docker-entrypoint.sh
```

- [ ] **Step 3: Create `Dockerfile` (multi-stage, Next.js standalone)**

```dockerfile
# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine

# ---- deps ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/src/lib/db/migrations ./src/lib/db/migrations
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=build /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["./entrypoint.sh"]
```

- [ ] **Step 4: Local Docker smoke**

```bash
docker build -t finance-dashboard:dev .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://host.docker.internal:5432/finance \
  -e RP_ID=localhost \
  -e RP_NAME=Finance \
  -e ORIGIN=http://localhost:3000 \
  -e SESSION_COOKIE_NAME=__Host-session \
  -e NODE_ENV=production \
  finance-dashboard:dev
```

In another terminal:

```bash
curl -i http://localhost:3000/api/health
```

Expected: 200 OK with the security headers from Task 18.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore scripts/docker-entrypoint.sh
git commit -m "$(cat <<'EOF'
build: add multi-stage Dockerfile with standalone Next.js output

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 25: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: finance
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/finance
      RP_ID: localhost
      RP_NAME: Finance Dashboard
      ORIGIN: http://localhost:3000
      SESSION_COOKIE_NAME: __Host-session
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Format check
        run: pnpm format:check
      - name: Typecheck
        run: pnpm typecheck
      - name: Migrate DB
        run: pnpm db:migrate
      - name: Unit tests
        run: pnpm test:unit -- --run
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      - name: E2E tests
        run: pnpm test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: add github actions workflow for lint/typecheck/unit/e2e

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push and verify**

```bash
git push -u origin main
```

Expected: GitHub Actions runs and the `CI` job goes green. (You will need to push the repo to GitHub first; if the remote does not exist, set it up under your account before this step.)

---

## Task 26: Fly.io deploy + GitHub Actions deploy job

**Files:**
- Create: `fly.toml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Install flyctl locally + log in**

```bash
brew install flyctl   # macOS
flyctl auth login
```

- [ ] **Step 2: Create the Fly app + Postgres**

```bash
flyctl apps create finance-dashboard --org personal
flyctl postgres create --name finance-pg --region fra --vm-size shared-cpu-1x --initial-cluster-size 1 --volume-size 1
flyctl postgres attach finance-pg --app finance-dashboard
```

Expected: `flyctl postgres attach` prints a `DATABASE_URL` and sets it as a secret on the app automatically.

- [ ] **Step 3: Set the rest of the secrets**

Replace `<YOUR_DOMAIN>` with the domain you'll point at the app.

```bash
flyctl secrets set --app finance-dashboard \
  RP_ID=<YOUR_DOMAIN> \
  RP_NAME='Finance Dashboard' \
  ORIGIN=https://<YOUR_DOMAIN> \
  SESSION_COOKIE_NAME=__Host-session \
  NODE_ENV=production \
  RUN_MIGRATIONS=1
```

- [ ] **Step 4: Create `fly.toml`**

```toml
app = "finance-dashboard"
primary_region = "fra"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    hard_limit = 200
    soft_limit = 100

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    method = "GET"
    path = "/api/health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

- [ ] **Step 5: First manual deploy**

```bash
flyctl deploy --app finance-dashboard
```

Expected: build runs, image pushed, machine started. After deploy:

```bash
curl -I https://<YOUR_DOMAIN>/api/health
```

Expected: 200 OK with all security headers.

- [ ] **Step 6: Issue first bootstrap token in production**

```bash
flyctl ssh console --app finance-dashboard -C 'node --experimental-strip-types /app/scripts/issue-bootstrap.ts'
```

(If `tsx` isn't bundled into the production image, run via `pnpm bootstrap:issue` after enabling SSH dev tooling — alternatively, create a tiny `node`-only version of the script for production. The simplest path is to build the script during the Docker build so it can run with plain `node`. If you choose the inline approach, log the token to stdout so `flyctl logs` shows it.)

Copy the printed token. Visit `https://<YOUR_DOMAIN>/enroll`, paste the token, complete enrollment on Mac. Then on iPhone, visit the same URL — passkey should be present via iCloud Keychain sync; sign in.

- [ ] **Step 7: Add deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: []
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@v1
      - run: flyctl deploy --remote-only --app finance-dashboard
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 8: Add `FLY_API_TOKEN` to GitHub repo secrets**

```bash
flyctl tokens create deploy --app finance-dashboard --name github-actions
```

Copy the token. In the GitHub repo: Settings → Secrets and variables → Actions → New repository secret → name `FLY_API_TOKEN`.

- [ ] **Step 9: Commit**

```bash
git add fly.toml .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: add fly.io deploy workflow and configuration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

Expected: Deploy workflow runs on push to `main`, deploys the new image, the production URL still serves `/api/health`.

---

## Task 27: Deployed-environment smoke test

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Append a post-deploy smoke step**

Edit `.github/workflows/deploy.yml`, adding to the `deploy` job after the `flyctl deploy` step:

```yaml
      - name: Wait for health
        run: |
          for i in $(seq 1 30); do
            if curl -fsS https://${{ vars.PROD_DOMAIN }}/api/health > /dev/null; then
              echo "healthy"; exit 0
            fi
            sleep 2
          done
          echo "Service did not become healthy"; exit 1
      - name: Verify security headers
        run: |
          set -e
          headers=$(curl -sI https://${{ vars.PROD_DOMAIN }}/api/health)
          for h in 'strict-transport-security' 'x-content-type-options' 'referrer-policy' 'x-frame-options' 'permissions-policy' 'content-security-policy'; do
            echo "$headers" | tr 'A-Z' 'a-z' | grep -q "$h: " || { echo "Missing header: $h"; exit 1; }
          done
          echo "All security headers present."
```

- [ ] **Step 2: Add `PROD_DOMAIN` repo variable**

GitHub repo: Settings → Secrets and variables → Actions → Variables → name `PROD_DOMAIN`, value `<YOUR_DOMAIN>`.

- [ ] **Step 3: Commit + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: smoke-check health and security headers after deploy

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push
```

Expected: deploy workflow succeeds end-to-end including the smoke step.

---

## Task 28: Phase-0 exit verification

**Files:** none (verification task)

- [ ] **Step 1: Verify exit criteria from spec §8 Phase 0**

Run each check, paste the output into the PR/branch description.

a) **Deploy a commit.**

```bash
git log -1 --pretty=format:'%h %s'
```

Confirm the latest commit appears in the Fly deploy output.

b) **Log in on Mac.** Visit `https://<YOUR_DOMAIN>/`. Expected: redirected to `/login`. Click "Sign in with passkey", complete biometric, redirected to `/`. See "Phase 0 — you are signed in."

c) **Log in on iPhone (iCloud-synced passkey).** Open Safari → `https://<YOUR_DOMAIN>/`. Same flow; passkey should be present via iCloud Keychain.

d) **All §7.8 headers verifiable via `curl -I`.**

```bash
curl -I https://<YOUR_DOMAIN>/api/health
```

Expected: 200 OK; all six headers (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy, Content-Security-Policy) are present.

e) **One end-to-end Playwright smoke test.**

```bash
pnpm test:e2e
```

Expected: 3 tests passing locally (the two smoke tests + headers test from Task 23).

f) **"Add to Home Screen" works on iPhone.** In Safari on iPhone, with `https://<YOUR_DOMAIN>/login` open: Share → Add to Home Screen → Add. Tap the new icon. App opens standalone (no Safari chrome). Sign in works the same way.

g) **Log out works.** From the signed-in placeholder, click "Sign out". Expected: redirected to `/login`.

h) **CI is green** on the latest push (Actions tab on GitHub).

- [ ] **Step 2: Tag the milestone**

```bash
git tag -a phase-0 -m "Phase 0 complete: foundation"
git push --tags
```

- [ ] **Step 3: Commit (only if any docs touched)**

If you updated `RUNBOOK.md` or notes during verification, commit them. Otherwise this task has no commit.

---

## Open notes / follow-ups for later phases

- **`bootstrap_token` and `challenge` tables** are auth-infrastructure tables not enumerated in spec §2.1. Add a one-line entry under §2.1 in a follow-up commit to the spec ("Auth infrastructure: `challenge` (short-TTL WebAuthn challenges), `bootstrap_token` (single-use first-enrollment tokens)").
- **CSP `'unsafe-inline'` for styles.** Required by Tailwind's runtime style injection. Tighten to nonces in Phase 4 alongside the performance pass.
- **Production bootstrap script execution.** The Docker image installs runtime deps only; running `tsx`-based scripts in production means either bundling `tsx` (we already do, since it's a dev dep — verify it's not pruned) or compiling the bootstrap script to plain JS at build time. Default to keeping `tsx` available; if image size becomes an issue, revisit.
- **`__Host-` cookie on local HTTP.** Modern browsers accept `__Host-`-prefixed cookies on `localhost` even without `Secure`. This convention is intentional and lets us use the same cookie name everywhere; production gets `Secure` automatically because `NODE_ENV=production`.
- **WebAuthn virtual authenticator E2E.** Phase 0 smoke covers redirect + UI rendering, not the cryptographic ceremony. Phase 4 polish adds a full E2E using Chrome's `WebAuthn` DevTools protocol.
- **One-session-per-user** (Task 11) deletes other sessions on each new login. This is the spec §7.3 invariant. It will be revisited in Phase 4 if multi-device-simultaneous use becomes desirable.
- **PWA service worker.** Spec §6.5 calls for one (Serwist/Workbox), but its real value is offline-tolerant caching of authenticated dashboard data, which doesn't exist yet in Phase 0. Defer the service worker until Phase 1 ships the dashboard.
