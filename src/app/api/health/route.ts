import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

/**
 * GET /api/health
 *
 * Used by Fly.io health checks and the post-deploy smoke step. Reads only
 * process.env.GIT_SHA directly — does NOT route through env() so the
 * endpoint succeeds even before app secrets are fully loaded. Returns
 * minimal info; never reveals DB or session state.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, version: process.env.GIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
