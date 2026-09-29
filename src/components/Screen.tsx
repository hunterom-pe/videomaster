import { logout } from "@/actions/auth";

export function Screen({
  title,
  storeLine,
  userEmail,
  children,
  status = "SYSTEM READY",
}: {
  title: string;
  storeLine?: string;
  userEmail?: string;
  children: React.ReactNode;
  status?: string;
}) {
  return (
    <div className="vm-screen">
      <div className="vm-frame">
        <div className="vm-titlebar">
          <span>VIDEOMASTER V1.0 — {title}</span>
          {userEmail ? (
            <form action={logout}>
              <span style={{ marginRight: 12, fontWeight: "normal" }}>{userEmail}</span>
              <button type="submit" className="vm-btn small">[ LOG OFF ]</button>
            </form>
          ) : null}
        </div>
        <div className="vm-body">{children}</div>
        <div className="vm-statusbar">
          <span>{status} · DATABASE ONLINE</span>
          {storeLine ? <span>{storeLine}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function ErrorBox({ message, errors }: { message: string; errors?: Record<string, string> }) {
  const list = errors ? Object.values(errors) : [];
  return (
    <div className="vm-alert" role="alert">
      <strong>*** ERROR ***</strong>
      {message}
      {list.length > 0 && (
        <ul>
          {list.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
