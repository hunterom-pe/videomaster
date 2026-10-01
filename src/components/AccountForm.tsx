"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/actions/staff";
import { ErrorBox } from "@/components/ErrorBox";

export function AccountForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    startTransition(async () => {
      const r = await changeOwnPassword({ current, password, confirm });
      if (r && !r.ok) { setMessage(r.message); setErrors(r.errors); return; }
      setMessage(""); setErrors({}); setDone(true); setCurrent(""); setPassword(""); setConfirm("");
    });
  }
  const field = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="vm-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={id === "cur" ? "current-password" : "new-password"} aria-invalid={!!errors[id === "cur" ? "current" : id === "new" ? "password" : "confirm"]} />
      {hint && <span className="vm-hint">{hint}</span>}
    </div>
  );
  return (
    <form onSubmit={submit} noValidate>
      {message && <ErrorBox message={message} errors={errors} />}
      {done && <div className="vm-notice" role="status">*** PASSWORD CHANGED. YOUR OTHER SIGNED-ON DEVICES WERE SIGNED OUT. ***</div>}
      <div className="vm-grid" style={{ gridTemplateColumns: "1fr", maxWidth: 420 }}>
        {field("cur", "CURRENT PASSWORD", current, setCurrent)}
        {field("new", "NEW PASSWORD", password, setPassword, "AT LEAST 10 CHARACTERS")}
        {field("conf", "CONFIRM NEW PASSWORD", confirm, setConfirm)}
      </div>
      <div className="vm-actions"><button type="submit" className="vm-btn" disabled={pending}>{pending ? "SAVING..." : "[ CHANGE PASSWORD ]"}</button></div>
    </form>
  );
}
