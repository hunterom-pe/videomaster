"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/actions/auth";
import { ErrorBox } from "@/components/ErrorBox";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const err = state?.errors ?? {};
  const isLogin = mode === "login";
  return (
    <form action={action} noValidate>
      {state && <ErrorBox message={state.message} errors={state.errors} />}
      <div className="vm-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="vm-field">
          <label htmlFor="email">E-MAIL ADDRESS</label>
          <input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!err.email} defaultValue={state?.values?.email} />
        </div>
        <div className="vm-field">
          <label htmlFor="password">PASSWORD</label>
          <input id="password" name="password" type="password" required aria-invalid={!!err.password}
            autoComplete={isLogin ? "current-password" : "new-password"} />
          {!isLogin && <span className="vm-hint">AT LEAST 10 CHARACTERS</span>}
        </div>
        {!isLogin && (
          <div className="vm-field">
            <label htmlFor="confirm">CONFIRM PASSWORD</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={!!err.confirm} />
          </div>
        )}
      </div>
      <div className="vm-stack" style={{ marginTop: 14 }}>
        <button type="submit" className="vm-btn" disabled={pending}>
          {pending ? "PLEASE WAIT..." : isLogin ? "[ LOG ON ]" : "[ CREATE ACCOUNT ]"}
        </button>
      </div>
      <hr className="vm-thin-rule" />
      <div className="vm-stack">
        <p className="vm-dim">{isLogin ? "NEW TO VIDEOMASTER?" : "ALREADY HAVE AN ACCOUNT?"}</p>
        <Link href={isLogin ? "/signup" : "/login"} className="vm-btn">
          {isLogin ? "[ CREATE ACCOUNT ]" : "[ LOG ON ]"}
        </Link>
      </div>
    </form>
  );
}
