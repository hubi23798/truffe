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

export function log(event: string, data: Record<string, unknown>): void {
  const payload = redact(data, { amountThresholdCents: AMOUNT_THRESHOLD_CENTS }) as Record<
    string,
    unknown
  >;
  const dataset = process.env.AXIOM_DATASET;
  const c = client();
  if (!c || !dataset) {
    if (process.env.NODE_ENV !== "test") {
      console.log(event, JSON.stringify(payload));
    }
    return;
  }
  c.ingest(dataset, [{ event, ...payload }]);
}
