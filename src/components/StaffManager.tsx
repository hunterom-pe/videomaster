"use client";

import { useState, useTransition } from "react";
import { addStaffAction, removeStaffAction, resetStaffPasswordAction, setStaffRoleAction } from "@/actions/staff";
import { RetroDialog } from "@/components/RetroDialog";
import { ErrorBox } from "@/components/ErrorBox";

export type StaffRow = { id: string; email: string; role: string; since: string };

type Dialog = { kind: "remove" | "reset"; member: StaffRow } | null;

export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const report = (r: Awaited<ReturnType<typeof addStaffAction>>, done: string) => {
    if (r && !r.ok) { setOk(""); setMessage([r.message, ...Object.values(r.errors)].join(" ")); return false; }
    setMessage(""); setOk(done); return true;
  };

  function add(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (report(await addStaffAction({ email, role, password }), `ACCOUNT CREATED FOR ${email.trim().toUpperCase()}. GIVE THEM THE PASSWORD IN PERSON; THEY CAN CHANGE IT UNDER [ MY ACCOUNT ].`)) { setEmail(""); setPassword(""); }
    });
  }
  function changeRole(m: StaffRow, next: string) {
    startTransition(async () => { report(await setStaffRoleAction(m.id, next), `${m.email.toUpperCase()} IS NOW A ${next}.`); });
  }
  function confirm() {
    if (!dialog) return;
    const { kind, member } = dialog;
    startTransition(async () => {
      const r = kind === "remove" ? await removeStaffAction(member.id) : await resetStaffPasswordAction(member.id, { password: newPassword });
      if (report(r, kind === "remove" ? `${member.email.toUpperCase()} WAS REMOVED AND CAN NO LONGER SIGN ON.` : `PASSWORD RESET FOR ${member.email.toUpperCase()}. THEY WERE SIGNED OUT EVERYWHERE.`)) { setDialog(null); setNewPassword(""); }
      else setDialog(null);
    });
  }

  return (
    <div>
      {message && <ErrorBox message={message} />}
      {ok && <div className="vm-notice" role="status">*** {ok} ***</div>}

      <fieldset className="vm-section">
        <legend>STAFF ({staff.length})</legend>
        {staff.length === 0 ? <span className="vm-dim">NO STAFF ACCOUNTS YET. ADD ONE BELOW.</span> : (
          <div className="vm-tablewrap">
            <table className="vm-table" style={{ minWidth: 620 }}>
              <thead><tr><th scope="col">E-MAIL</th><th scope="col">ROLE</th><th scope="col">ADDED</th><th scope="col">ACTIONS</th></tr></thead>
              <tbody>
                {staff.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td>
                      <select aria-label={`Role for ${m.email}`} value={m.role} disabled={pending} onChange={(e) => changeRole(m, e.target.value)}>
                        <option value="MANAGER">MANAGER</option>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                      </select>
                    </td>
                    <td>{m.since}</td>
                    <td>
                      <span className="vm-actions" style={{ marginTop: 0 }}>
                        <button type="button" className="vm-btn small" onClick={() => { setNewPassword(""); setDialog({ kind: "reset", member: m }); }}>[ RESET PASSWORD ]</button>
                        <button type="button" className="vm-btn small danger" onClick={() => setDialog({ kind: "remove", member: m })}>[ REMOVE ]</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      <form onSubmit={add} noValidate>
        <fieldset className="vm-section">
          <legend>ADD A STAFF ACCOUNT</legend>
          <div className="vm-grid">
            <div className="vm-field">
              <label htmlFor="st-email">STAFF E-MAIL</label>
              <input id="st-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="vm-field">
              <label htmlFor="st-role">ROLE</label>
              <select id="st-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
              </select>
            </div>
            <div className="vm-field">
              <label htmlFor="st-pw">STARTING PASSWORD</label>
              <input id="st-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
              <span className="vm-hint">AT LEAST 10 CHARACTERS. TELL THEM IN PERSON.</span>
            </div>
          </div>
          <div className="vm-actions"><button type="submit" className="vm-btn" disabled={pending}>{pending ? "SAVING..." : "[ CREATE ACCOUNT ]"}</button></div>
        </fieldset>
      </form>

      {dialog && (
        <RetroDialog title={dialog.kind === "remove" ? "REMOVE STAFF MEMBER" : "RESET PASSWORD"} onCancel={() => setDialog(null)}>
          <p className="vm-center">{dialog.member.email.toUpperCase()}</p>
          {dialog.kind === "reset" ? (
            <div className="vm-field">
              <label htmlFor="st-newpw">NEW PASSWORD</label>
              <input id="st-newpw" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="off" data-autofocus />
              <span className="vm-hint">AT LEAST 10 CHARACTERS. THEY ARE SIGNED OUT EVERYWHERE.</span>
            </div>
          ) : (
            <p className="vm-center">THEY WILL BE SIGNED OUT AND CAN NO LONGER USE THE SYSTEM. PAST TRANSACTIONS KEEP THEIR NAME.</p>
          )}
          <div className="vm-actions" style={{ justifyContent: "center" }}>
            <button type="button" className={`vm-btn${dialog.kind === "remove" ? " danger" : ""}`} onClick={confirm} disabled={pending}>{dialog.kind === "remove" ? "[ YES, REMOVE ]" : "[ RESET ]"}</button>
            <button type="button" className="vm-btn" onClick={() => setDialog(null)} data-autofocus={dialog.kind === "remove" ? true : undefined}>[ CANCEL ]</button>
          </div>
        </RetroDialog>
      )}
    </div>
  );
}
