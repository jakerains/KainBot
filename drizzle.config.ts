import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The Vercel Neon integration writes connection strings into .env.local.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations use the DIRECT (unpooled) connection — DDL over PgBouncer is unreliable.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
