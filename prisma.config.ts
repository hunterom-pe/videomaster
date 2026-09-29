import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// MIGRATE_DATABASE_URL (optional) is a direct, non-pooled connection used only by
// the Prisma CLI (migrations). The running app always uses DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.MIGRATE_DATABASE_URL || env("DATABASE_URL") },
});
