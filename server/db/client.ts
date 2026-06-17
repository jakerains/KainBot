import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Neon's serverless driver needs a WebSocket implementation under Node.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Don't throw at import time (that would break `nuxt build` prerender); surface the real cause.
  // NOTE: the `eve` service needs DATABASE_URL too — it validates the web session via Better Auth
  // in-process, so the var must be present on BOTH the web and eve Vercel services.
  console.error(
    "[db] DATABASE_URL is not set on this service — database queries will fail.",
  );
}

// `DATABASE_URL` is the pooled (PgBouncer) connection from the Vercel Neon integration — correct
// for short-lived serverless invocations. Pool construction is lazy (connects on first query).
// `max` bounds client connections per warm instance; the 'error' handler keeps an out-of-band idle
// WebSocket error (PgBouncer recycle / compute suspend) from crashing the function instance.
const pool = new Pool({ connectionString, max: 10 });
pool.on("error", (err: Error) => {
  console.error("[db pool] unexpected idle client error", err);
});

export const db = drizzle(pool, { schema });
export { schema };
