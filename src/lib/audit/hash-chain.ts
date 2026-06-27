import { createHash } from "node:crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function computeHash(prevHash: Buffer, payload: unknown): Buffer {
  const h = createHash("sha256");
  h.update(prevHash);
  h.update(canonicalize(payload));
  return h.digest();
}

export interface ChainRow {
  prevHash: Buffer;
  thisHash: Buffer;
  payload: unknown;
}

export function verifyChain(rows: ChainRow[]): { valid: boolean; brokenAt: number | null } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const expected = computeHash(row.prevHash, row.payload);
    if (!expected.equals(row.thisHash)) return { valid: false, brokenAt: i };
    if (i > 0 && !row.prevHash.equals(rows[i - 1]!.thisHash)) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true, brokenAt: null };
}
