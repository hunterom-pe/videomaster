"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema, signupSchema, zodErrors, type ActionState } from "@/lib/validation";

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = signupSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS BELOW", values };
  if (formData.get("password") !== formData.get("confirm"))
    return { ok: false, errors: { confirm: "PASSWORDS DO NOT MATCH" }, message: "PLEASE CORRECT THE FIELDS BELOW", values };

  try {
    const user = await db.user.create({
      data: { email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) },
    });
    await createSession(user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, errors: { email: "AN ACCOUNT WITH THIS E-MAIL ALREADY EXISTS" }, message: "ACCOUNT NOT CREATED", values };
    throw e;
  }
  redirect("/");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), message: "PLEASE CORRECT THE FIELDS BELOW", values };

  const keys = [`email:${parsed.data.email}`, `ip:${await clientIp()}`];
  if (await isRateLimited(keys))
    return { ok: false, errors: {}, message: "TOO MANY FAILED SIGN-ONS. WAIT 15 MINUTES AND TRY AGAIN.", values };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordFailure(keys, user?.id);
    return { ok: false, errors: {}, message: "INVALID E-MAIL OR PASSWORD", values };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
