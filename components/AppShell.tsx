"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const ICON_PROPS = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;

/** Add a row here to add a tab to the vertical nav. */
const TABS = [
  {
    href: "/orders",
    label: "Assisted Orders",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    )
  },
  {
    href: "/investigations",
    label: "Investigations",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    )
  }
];

const COLLAPSE_KEY = "ov.sidebar.collapsed";

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
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="app">
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <span className="name">order verification</span>
          <button
            type="button"
            className="collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
            </svg>
          </button>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              title={collapsed ? t.label : undefined}
              onClick={() => setOpen(false)}
              className={`nav-item ${pathname?.startsWith(t.href) ? "active" : ""}`}
            >
              <span className="nav-ico">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar" title={collapsed ? (session?.user?.name ?? "") : undefined}>
            {initials(session?.user?.name)}
          </div>
          <div className="who">
            <div className="n">{session?.user?.name ?? ""}</div>
            <div className="e">{session?.user?.email ?? ""}</div>
          </div>
          <button type="button" className="signout" title="Sign out" onClick={() => signOut({ callbackUrl: "/login" })}>
            <span className="signout-text">Sign out</span>
            <svg className="signout-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
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
