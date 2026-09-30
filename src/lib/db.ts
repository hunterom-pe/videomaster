import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { poolSettings } from "@/lib/db-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg(poolSettings(connectionString, { DB_SSL: process.env.DB_SSL, DB_POOL_MAX: process.env.DB_POOL_MAX })) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
