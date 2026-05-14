import { NextResponse } from "next/server";
import { fetchDailyRates, fetchHistoricalRates } from "@/lib/fx/ecb";
import { storeRates } from "@/lib/fx/rates";
import { getDb } from "@/lib/db/client";
import { env } from "@/env";

function isAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (dev mode)
  return req.headers.get("x-cron-secret") === secret;
}

/** POST /api/cron/fx-rates?backfill=true — fetch ECB rates (daily or full history). */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const backfill = searchParams.get("backfill") === "true";

  try {
    const rates = backfill
      ? await fetchHistoricalRates("2018-01-01")
      : await fetchDailyRates();

    const stored = await storeRates(getDb(), rates);
    return NextResponse.json({ ok: true, fetched: rates.length, stored });
  } catch (e) {
    const message = e instanceof Error ? e.message : "FX fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
