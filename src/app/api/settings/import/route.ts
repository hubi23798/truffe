import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DuplicateFileError, ingest } from "@/lib/ingestion/ingest";
import { readSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/env";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  // Auth (defense-in-depth; proxy already guards the route)
  const cookieStore = await cookies();
  const sid = cookieStore.get(env().SESSION_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sess = await readSession(getDb(), sid);
  if (!sess) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (!fileEntry.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only .csv files are accepted" }, { status: 400 });
  }

  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());

  try {
    const result = await ingest(getDb(), buffer);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof DuplicateFileError) {
      return NextResponse.json(
        { error: "This file has already been imported", batchId: e.existingBatchId },
        { status: 409 },
      );
    }
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
