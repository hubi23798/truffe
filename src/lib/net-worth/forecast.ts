import type { NetWorthPoint } from "./engine";

export interface ForecastPoint {
  date: string;
  netWorth: number;
  isForecast: boolean;
}

export interface ForecastResult {
  points: ForecastPoint[];
  monthlyDelta: number;
  projected12m: number;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildForecast(history: NetWorthPoint[], today: string): ForecastResult {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  const historicalPoints: ForecastPoint[] = sorted.map((p) => ({ ...p, isForecast: false }));

  if (sorted.length < 2) {
    const current = sorted[0]?.netWorth ?? 0;
    return { points: historicalPoints, monthlyDelta: 0, projected12m: current };
  }

  const earliest = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;
  const daySpan =
    (new Date(latest.date).getTime() - new Date(earliest.date).getTime()) / 86_400_000;
  const monthlyDelta = daySpan > 0 ? ((latest.netWorth - earliest.netWorth) / daySpan) * 30 : 0;

  const forecastPoints: ForecastPoint[] = Array.from({ length: 12 }, (_, i) => ({
    date: addMonths(today, i + 1),
    netWorth: Math.round(latest.netWorth + monthlyDelta * (i + 1)),
    isForecast: true,
  }));

  return {
    points: [...historicalPoints, ...forecastPoints],
    monthlyDelta: Math.round(monthlyDelta),
    projected12m: forecastPoints[11]!.netWorth,
  };
}
