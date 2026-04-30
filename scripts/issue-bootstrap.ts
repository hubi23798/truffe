/**
 * Issue a bootstrap token for first-passkey enrollment.
 *
 * Run via `pnpm bootstrap:issue` with DATABASE_URL set. Prints a single-use
 * raw token to stdout; the hash is stored in the database. Token is valid
 * for BOOTSTRAP_TOKEN_TTL_MS (1 hour).
 */
import { BOOTSTRAP_TOKEN_TTL_MS, issueBootstrapToken } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db/client";

async function main() {
  const db = getDb();
  const token = await issueBootstrapToken(db);
  const minutes = Math.round(BOOTSTRAP_TOKEN_TTL_MS / 60_000);
  process.stdout.write(`Bootstrap token (single-use, expires in ${minutes} min):\n${token}\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`Failed to issue bootstrap token: ${String(err)}\n`);
  process.exit(1);
});
