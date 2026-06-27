const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "password",
  "service_role_key",
  "anon_key",
  "api_key",
]);
const DIGIT_RUN = /^\d{8,}$/;
const REDACTED = "[redacted]" as const;

export interface RedactOptions {
  amountThresholdCents?: number;
}

export function redact(input: unknown, opts: RedactOptions = {}): unknown {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((x) => redact(x, opts));
  const threshold = opts.amountThresholdCents;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEYS.has(k)) {
      out[k] = REDACTED;
      continue;
    }
    if (typeof v === "string" && DIGIT_RUN.test(v)) {
      out[k] = REDACTED;
      continue;
    }
    if (k === "amount" && typeof v === "number" && threshold !== undefined && v >= threshold) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redact(v, opts);
  }
  return out;
}
