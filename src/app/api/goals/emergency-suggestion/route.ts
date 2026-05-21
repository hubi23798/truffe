import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/env";
import { suggestEmergencyFund } from "@/lib/goals/suggest";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const sess = await readSession(db, sid);
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suggestion = await suggestEmergencyFund(db);
  return NextResponse.json(suggestion);
}
