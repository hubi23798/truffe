import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { weeklyDebrief, PRIMARY_USER_ID } from "@/lib/db/schema";
import { generateDebrief } from "@/lib/debrief/generate";
import { env } from "@/env";

function isAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // This week's Monday (day=0 means Sunday, so go back 6 days to Mon)
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  thisMonday.setUTCHours(0, 0, 0, 0);

  // Previous complete week: Mon through Sun immediately before thisMonday
  const weekStart = new Date(thisMonday);
  weekStart.setUTCDate(thisMonday.getUTCDate() - 7);

  const weekEnd = new Date(thisMonday);
  weekEnd.setUTCDate(thisMonday.getUTCDate() - 1);
  weekEnd.setUTCHours(23, 59, 59, 999);

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
