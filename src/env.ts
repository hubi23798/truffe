import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")),
  RP_ID: z.string().min(1),
  RP_NAME: z.string().min(1),
  ORIGIN: z.string().url(),
  // Cookie names default to non-__Host- variants because __Host- requires
  // Secure + HTTPS, which aren't available on local HTTP dev. Production
  // must override these to "__Host-session" / "__Host-enrollment" (and
  // serves over HTTPS so Secure is set). See cookies.ts.
  SESSION_COOKIE_NAME: z.string().default("session"),
  ENROLLMENT_COOKIE_NAME: z.string().default("enrollment"),
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
