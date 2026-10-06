"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Col } from "@/lib/columns";
import { formatCell } from "@/lib/format";
import type { Cell } from "@/lib/bqvalue";

const PAGE_SIZE = 50;
const RIGHT_ALIGNED = new Set(["money", "num", "int"]);

function compare(col: Col, a: Cell, b: Cell): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1; // blanks always last
  if (b === null || b === "") return -1;
  if (RIGHT_ALIGNED.has(col.type) || col.type === "bool") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function CellView({ col, value }: { col: Col; value: Cell }) {
  if (value === null || value === "") return <>—</>;
  if (col.type === "bool") return <span className={`pill ${value ? "yes" : "no"}`}>{value ? "TRUE" : "FALSE"}</span>;
  if (col.type === "flag") return <span className="pill flag">{String(value)}</span>;
  return <>{formatCell(col, value)}</>;
}

interface Props {
  cols: Col[];
  rows: Cell[][];
  /** localStorage key remembering which columns the user picked. */
  storageKey: string;
  searchPlaceholder: string;
  /** Column keys shown by default; omit to show every column. */
  defaultVisible?: string[];
  /** Extra buttons rendered between the search box and the Columns menu. */
  tools?: React.ReactNode;
}

/** Search + sortable columns + column picker + pager, shared by every table in the app. */
export default function DataTable({ cols, rows, storageKey, searchPlaceholder, defaultVisible, tools }: Props) {
  const fallback = useMemo(() => defaultVisible ?? cols.map((c) => c.key), [defaultVisible, cols]);
  const [visible, setVisible] = useState<string[]>(fallback);
  const [colMenu, setColMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore the user's column choice (best effort; storage can be blocked).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved)) {
        const valid = saved.filter((k) => cols.some((c) => c.key === k));
        if (valid.length) setVisible(valid);
      }
    } catch {}
  }, [storageKey, cols]);

  useEffect(() => setPage(0), [rows]);

  const toggleColumn = (key: string) => {
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      if (next.length === 0) return cur; // keep at least one
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Close the Columns menu on outside click.
  useEffect(() => {
    if (!colMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colMenu]);

  const shownCols = useMemo(() => cols.filter((c) => visible.includes(c.key)), [cols, visible]);

  // Search covers every column, not just the visible ones.
  const haystacks = useMemo(
    () => rows.map((r) => cols.map((c, i) => formatCell(c, r[i]) + " " + (r[i] ?? "")).join(" ").toLowerCase()),
    [rows, cols]
  );

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    let idx = rows.map((_, i) => i);
    if (q) idx = idx.filter((i) => haystacks[i].includes(q));
    if (sort) {
      const ci = cols.findIndex((c) => c.key === sort.key);
      const col = cols[ci];
      idx = [...idx].sort((a, b) => sort.dir * compare(col, rows[a][ci], rows[b][ci]));
    }
    return idx;
  }, [rows, haystacks, query, sort, cols]);

  const pageCount = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = view.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const onSort = (key: string) =>
    setSort((cur) => (cur?.key === key ? (cur.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <span className="ico">⌕</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
          />
        </div>
        {tools}
        <div className="pop-wrap" ref={menuRef}>
          <button type="button" className={`btn-tool ${colMenu ? "on" : ""}`} onClick={() => setColMenu((o) => !o)}>
            ☰ Columns
          </button>
          {colMenu && (
            <div className="pop">
              <div className="pop-h">Columns shown</div>
              {cols.map((c) => (
                <button type="button" key={c.key} className="pop-item" onClick={() => toggleColumn(c.key)}>
                  <span>{c.label}</span>
                  <span className="chk">{visible.includes(c.key) ? "✓" : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view.length === 0 ? (
        <div className="empty-box">
          <div className="t">Nothing matches your search</div>
          <div className="b">Try a different keyword, or clear the search box.</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table className="grid">
              <thead>
                <tr>
                  {shownCols.map((c) => (
                    <th
                      key={c.key}
                      className={`${RIGHT_ALIGNED.has(c.type) ? "r" : ""} ${sort?.key === c.key ? "sorted" : ""}`}
                      onClick={() => onSort(c.key)}
                      title="Click to sort"
                    >
                      {c.label}
                      {sort?.key === c.key && <span className="arrow">{sort.dir === 1 ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((ri) => (
                  <tr key={ri}>
                    {shownCols.map((c) => {
                      const v = rows[ri][cols.indexOf(c)];
                      const cls = [
                        RIGHT_ALIGNED.has(c.type) ? "r" : "",
                        c.mono ? "mono" : "",
                        c.key === "customer_name" ? "strong" : "",
                        v === null || v === "" ? "empty" : ""
                      ].join(" ");
                      return (
                        <td key={c.key} className={cls} title={c.type === "text" && v ? String(v) : undefined}>
                          <CellView col={c} value={v} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="info">
              Showing {(safePage * PAGE_SIZE + 1).toLocaleString("en-IN")}–
              {Math.min((safePage + 1) * PAGE_SIZE, view.length).toLocaleString("en-IN")} of{" "}
              {view.length.toLocaleString("en-IN")}
            </span>
            <div className="btns">
              <button type="button" className="btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ← Prev
              </button>
              <button
                type="button"
                className="btn-sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
