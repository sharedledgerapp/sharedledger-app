import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Tables that exist in the DB but aren't declared in shared/schema.ts because
  // something other than Drizzle owns them — exclude them so `db:push` never
  // proposes dropping them. `session` is connect-pg-simple's login-session
  // store; `_applied_migrations` tracks the hand-written SQL files in /migrations.
  tablesFilter: ["!session", "!_applied_migrations"],
});
