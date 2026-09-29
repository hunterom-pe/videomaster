import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("verifies the right password and rejects wrong ones", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("salts each hash", async () => expect(await hashPassword("x")).not.toBe(await hashPassword("x")));
  it("dummy hash never verifies", async () => expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false));
});
