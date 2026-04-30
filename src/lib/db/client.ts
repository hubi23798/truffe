import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

let queryClient: ReturnType<typeof postgres> | undefined;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!dbInstance) {
    queryClient = postgres(env().DATABASE_URL, { max: 5 });
    dbInstance = drizzle(queryClient, { schema });
  }
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;
