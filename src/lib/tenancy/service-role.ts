import { createServiceRoleClient } from "@/lib/supabase/server";

interface Options {
  requireCronContext?: boolean;
}

export async function runAsService<T>(
  fn: (client: ReturnType<typeof createServiceRoleClient>) => Promise<T>,
  opts: Options = {},
): Promise<T> {
  if (opts.requireCronContext && process.env.CRON_CONTEXT !== "1") {
    throw new Error("runAsService called outside cron context");
  }
  const client = createServiceRoleClient();
  return await fn(client);
}
