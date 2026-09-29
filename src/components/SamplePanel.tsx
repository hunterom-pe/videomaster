"use client";

import { useState, useTransition } from "react";
import { clearData, loadSample } from "@/actions/sample";
import { ErrorBox } from "@/components/Screen";

export function SamplePanel({ isEmpty, isOwner, canManage }: { isEmpty: boolean; isOwner: boolean; canManage: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    setConfirming(false);
    setMessage("");
    startTransition(async () => {
      const r = await loadSample();
      if (r && !r.ok) setMessage(r.message);
    });
  }
  function clear() {
    setMessage("");
    startTransition(async () => {
      const r = await clearData(typed);
      if (r && !r.ok) setMessage([r.message, ...Object.values(r.errors)].join(" "));
    });
  }

  return (
    <div>
      {message && <ErrorBox message={message} />}
      <fieldset className="vm-section">
        <legend>SAMPLE STORE DATA</legend>
        <p>
          LOAD A COMPLETE DEMO: 28 CLASSIC MOVIES, FICTIONAL CUSTOMERS, MERCHANDISE, AND THREE WEEKS OF RENTALS, RETURNS, LATE FEES AND SALES.
        </p>
        {!isEmpty && (
          <div className="vm-notice" role="status">
            SAMPLE DATA CAN ONLY BE LOADED INTO A STORE WITH NO CUSTOMERS, TITLES, MERCHANDISE OR TRANSACTIONS.
            {isOwner ? " USE [ CLEAR ALL STORE DATA ] BELOW FIRST IF YOU WANT TO START OVER." : ""}
          </div>
        )}
        <div className="vm-actions">
          <button type="button" className="vm-btn" disabled={!isEmpty || !canManage || pending} onClick={() => setConfirming(true)}>
            {pending ? "BUILDING DEMO STORE..." : "[ LOAD SAMPLE STORE DATA ]"}
          </button>
        </div>
        {confirming && (
          <div role="alertdialog" aria-modal="true" aria-labelledby="sdlg" style={{ border: "4px double var(--yellow)", background: "var(--bg)", padding: 16, maxWidth: 440, margin: "16px auto" }}>
            <h2 id="sdlg" className="vm-yellow vm-center">LOAD SAMPLE DATA?</h2>
            <hr className="vm-thin-rule" />
            <p className="vm-center">THIS ADDS DEMO CUSTOMERS, MOVIES, MERCHANDISE AND TRANSACTIONS TO YOUR STORE.</p>
            <div className="vm-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="vm-btn" onClick={load}>[ YES ]</button>
              <button type="button" className="vm-btn" onClick={() => setConfirming(false)}>[ NO ]</button>
            </div>
          </div>
        )}
      </fieldset>

      {isOwner && (
        <fieldset className="vm-section" style={{ borderColor: "var(--red)" }}>
          <legend className="vm-red">DANGER: CLEAR STORE DATA</legend>
          <p>
            PERMANENTLY DELETES ALL CUSTOMERS, MOVIE TITLES AND COPIES, MERCHANDISE, RENTALS AND TRANSACTIONS.
            STORE SETTINGS, FORMATS AND RENTAL CATEGORIES ARE KEPT. THIS CANNOT BE UNDONE.
          </p>
          <div className="vm-searchbar">
            <div className="vm-field" style={{ flex: "0 1 260px" }}>
              <label htmlFor="clearConfirm">TYPE &quot;CLEAR&quot; TO CONFIRM</label>
              <input id="clearConfirm" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <button type="button" className="vm-btn danger" disabled={typed !== "CLEAR" || pending} onClick={clear}>[ CLEAR ALL STORE DATA ]</button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
