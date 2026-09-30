import { describe, expect, it } from "vitest";
import { poolSettings } from "@/lib/db-config";

const SUPABASE = "postgresql://postgres.abcdefgh:p%40ss%2Fword@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";

describe("poolSettings", () => {
  it("leaves local databases untouched", () => {
    const s = poolSettings("postgresql://me@localhost:5432/videomaster");
    expect(s.connectionString).toBe("postgresql://me@localhost:5432/videomaster");
    expect(s.ssl).toBeUndefined();
    expect(s.max).toBe(5);
  });
  it("Supabase: encrypted but without chain verification, sslmode removed so it cannot override", () => {
    const s = poolSettings(SUPABASE);
    expect(s.ssl).toEqual({ rejectUnauthorized: false });
    expect(s.connectionString).not.toContain("sslmode");
    expect(s.connectionString).toContain("aws-0-us-east-1.pooler.supabase.com:5432/postgres");
  });
  it("keeps special characters in the password intact", () => {
    const u = new URL(poolSettings(SUPABASE).connectionString);
    expect(decodeURIComponent(u.password)).toBe("p@ss/word");
    expect(decodeURIComponent(u.username)).toBe("postgres.abcdefgh");
  });
  it("DB_SSL=no-verify forces it for any host; other hosts keep their URL", () => {
    expect(poolSettings("postgresql://u:p@db.example.com/x?sslmode=require", { DB_SSL: "no-verify" }).ssl).toBeDefined();
    const normal = poolSettings("postgresql://u:p@db.example.com/x?sslmode=require");
    expect(normal.ssl).toBeUndefined();
    expect(normal.connectionString).toContain("sslmode=require");
  });
  it("bounds the pool size", () => {
    const url = "postgresql://me@localhost/x";
    expect(poolSettings(url, { DB_POOL_MAX: "3" }).max).toBe(3);
    for (const bad of ["0", "-2", "99", "abc", ""]) expect(poolSettings(url, { DB_POOL_MAX: bad }).max).toBe(5);
  });
  it("does not throw on a malformed URL", () => expect(poolSettings("not a url").connectionString).toBe("not a url"));
});
