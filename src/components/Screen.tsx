import { cookies } from "next/headers";
import { logout } from "@/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export async function Screen({
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
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="vm-screen">
      <a className="vm-skip" href="#main">SKIP TO MAIN CONTENT</a>
      <div className="vm-frame">
        <header className="vm-titlebar">
          <span>VIDEOMASTER V1.0 — {title}</span>
          <span className="vm-titlebar-tools">
            <ThemeToggle initial={theme} />
            {userEmail ? (
              <form action={logout}>
                <span style={{ marginRight: 12, fontWeight: "normal" }}>{userEmail}</span>
                <button type="submit" className="vm-btn small">[ LOG OFF ]</button>
              </form>
            ) : null}
          </span>
        </header>
        <main id="main" className="vm-body" tabIndex={-1}>{children}</main>
        <footer className="vm-statusbar">
          <span>{status} · DATABASE ONLINE</span>
          {storeLine ? <span>{storeLine}</span> : null}
        </footer>
      </div>
    </div>
  );
}
