"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

/** Add a row here to add a tab to the vertical nav. */
const TABS = [{ href: "/orders", label: "Assisted Orders" }];

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="app">
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="name">order verification</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className={`nav-item ${pathname?.startsWith(t.href) ? "active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">{initials(session?.user?.name)}</div>
          <div className="who">
            <div className="n">{session?.user?.name ?? ""}</div>
            <div className="e">{session?.user?.email ?? ""}</div>
          </div>
          <button type="button" className="signout" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="mobile-bar">
          <button type="button" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>order verification</span>
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
