export type Frequency = "weekly" | "fortnightly" | "monthly";

export interface RecurringItem {
  key: string;
  description: string;
  accountId: string;
  frequency: Frequency;
  amountNative: number;
  currency: string;
  occurrences: Date[];
  lastDate: Date;
  nextExpected: Date;
  daysSinceLastSeen: number;
}

interface InputTxn {
  accountId: string;
  descriptionRaw: string | null;
  amountNative: number;
  currency: string;
  startedAt: Date;
}

const GAP_RANGES: Record<Frequency, [number, number]> = {
  weekly: [5, 9],
  fortnightly: [10, 21],
  monthly: [22, 40],
};

const PERIOD_DAYS: Record<Frequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

function normalizeDesc(raw: string | null): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

function classifyGap(days: number): Frequency | null {
  for (const [freq, [lo, hi]] of Object.entries(GAP_RANGES) as [Frequency, [number, number]][]) {
    if (days >= lo && days <= hi) return freq;
  }
  return null;
}

function majorityFrequency(gaps: number[]): Frequency | null {
  const counts: Record<Frequency, number> = { weekly: 0, fortnightly: 0, monthly: 0 };
  for (const g of gaps) {
    const f = classifyGap(g);
    if (f) counts[f]++;
  }
  const [best] = (Object.entries(counts) as [Frequency, number][]).sort(([, a], [, b]) => b - a);
  if (!best || counts[best[0]] === 0) return null;
  // Require majority: more than half the gaps must agree
  if (counts[best[0]] <= gaps.length / 2) return null;
  return best[0];
}

export function detectRecurring(txns: InputTxn[], asOf: Date = new Date()): RecurringItem[] {
  // Group by (accountId, normalizedDescription, sign of amount)
  const groups = new Map<string, InputTxn[]>();
  for (const t of txns) {
    const desc = normalizeDesc(t.descriptionRaw);
    if (!desc) continue;
    const sign = t.amountNative >= 0 ? "+" : "-";
    const key = `${t.accountId}|${desc}|${sign}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(t);
    groups.set(key, bucket);
  }

  const results: RecurringItem[] = [];

  for (const [key, bucket] of groups) {
    if (bucket.length < 2) continue;

    // Sort ascending by date
    const sorted = [...bucket].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1]!.startedAt, sorted[i]!.startedAt));
    }

    const freq = majorityFrequency(gaps);
    if (!freq) continue;

    const last = sorted[sorted.length - 1]!;
    const nextExpected = new Date(last.startedAt.getTime() + PERIOD_DAYS[freq] * 86_400_000);
    const daysSince = daysBetween(last.startedAt, asOf);

    // Median amount
    const amounts = sorted.map((t) => t.amountNative).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)]!;

    results.push({
      key,
      description: sorted[sorted.length - 1]!.descriptionRaw ?? "",
      accountId: bucket[0]!.accountId,
      frequency: freq,
      amountNative: median,
      currency: bucket[0]!.currency,
      occurrences: sorted.map((t) => t.startedAt),
      lastDate: last.startedAt,
      nextExpected,
      daysSinceLastSeen: daysSince,
    });
  }

  // Sort: monthly first (highest value), then fortnightly, weekly; within each by absolute amount desc
  const freqOrder: Record<Frequency, number> = { monthly: 0, fortnightly: 1, weekly: 2 };
  results.sort(
    (a, b) =>
      freqOrder[a.frequency] - freqOrder[b.frequency] ||
      Math.abs(b.amountNative) - Math.abs(a.amountNative),
  );

  return results;
}
