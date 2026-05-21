import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { weeklyDebrief, PRIMARY_USER_ID } from "@/lib/db/schema";
import { generateDebrief } from "@/lib/debrief/generate";
import { env } from "@/env";

function lastMondayUTC(from: Date): Date {
  const day = from.getUTCDay(); // 0 = Sun, 1 = Mon
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(from);
  monday.setUTCDate(from.getUTCDate() - daysBack);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // weekEnd = last Sunday (the Sunday before this Monday)
  const monday = lastMondayUTC(now);
  const weekEnd = new Date(monday);
  weekEnd.setUTCDate(monday.getUTCDate() - 1);
  weekEnd.setUTCHours(23, 59, 59, 999);

  // weekStart = Monday before weekEnd
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekEnd.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);

  const db = getDb();
  const output = await generateDebrief(db, { weekStart, weekEnd });

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  await db
    .insert(weeklyDebrief)
    .values({
      userId: PRIMARY_USER_ID,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      narrativeText: output.narrativeText,
      flags: output.flags,
    })
    .onConflictDoUpdate({
      target: [weeklyDebrief.userId, weeklyDebrief.weekStart],
      set: {
        narrativeText: output.narrativeText,
        flags: output.flags,
        generatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true, weekStart: weekStartStr });
}
