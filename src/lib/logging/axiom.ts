import { Axiom } from "@axiomhq/js";
import { redact } from "./redact";

const AMOUNT_THRESHOLD_CENTS = 100_00;

let axiom: Axiom | null = null;

function client(): Axiom | null {
  const token = process.env.AXIOM_TOKEN;
  if (!axiom && token) {
    axiom = new Axiom({ token });
  }
  return axiom;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return "[circular]";
      seen.add(v as object);
    }
    return v;
  });
}

export function log(event: string, data: Record<string, unknown>): void {
  const payload = redact(data, { amountThresholdCents: AMOUNT_THRESHOLD_CENTS }) as Record<
    string,
    unknown
  >;
  const dataset = process.env.AXIOM_DATASET;
  const c = client();
  if (!c || !dataset) {
    if (process.env.NODE_ENV !== "test") {
      console.log(event, safeStringify(payload));
    }
    return;
  }
  try {
    void Promise.resolve(c.ingest(dataset, [{ event, ...payload }])).catch(() => {});
  } catch {
    /* swallow — logging must never crash the request */
  }
}
