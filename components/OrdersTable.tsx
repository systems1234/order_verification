"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLUMNS, type Col } from "@/lib/columns";
import { formatCell, isoDay } from "@/lib/format";

type Cell = string | number | boolean | null;

const PAGE_SIZE = 50;
const VIEW_START = "2025-07-01"; // the view's own floor
const STORAGE_KEY = "ov.orders.columns";

const PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: 0 }
] as const;
type PresetId = (typeof PRESETS)[number]["id"];

function rangeFor(id: PresetId): { from: string; to: string } {
  const today = new Date();
  const preset = PRESETS.find((p) => p.id === id)!;
  if (!preset.days) return { from: VIEW_START, to: isoDay(today) };
  const from = new Date(today);
  from.setDate(from.getDate() - preset.days);
  return { from: isoDay(from), to: isoDay(today) };
}

const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.def).map((c) => c.key);
const RIGHT_ALIGNED = new Set(["money", "num", "int"]);

function compare(col: Col, a: Cell, b: Cell): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1; // blanks always last
  if (b === null || b === "") return -1;
  if (RIGHT_ALIGNED.has(col.type)) return Number(a) - Number(b);
  if (col.type === "bool") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function CellView({ col, value }: { col: Col; value: Cell }) {
  if (value === null || value === "") return <>—</>;
  if (col.type === "bool") return <span className={`pill ${value ? "yes" : "no"}`}>{value ? "TRUE" : "FALSE"}</span>;
  if (col.type === "flag") return <span className="pill flag">{String(value)}</span>;
  return <>{formatCell(col, value)}</>;
}

export default function OrdersTable() {
  const [preset, setPreset] = useState<PresetId>("30");
  const [rows, setRows] = useState<Cell[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [colMenu, setColMenu] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // Restore the user's column choice (best effort; storage can be blocked).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved)) {
        const valid = saved.filter((k) => COLUMNS.some((c) => c.key === k));
        if (valid.length) setVisible(valid);
      }
    } catch {}
  }, []);

  const toggleColumn = (key: string) => {
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      if (next.length === 0) return cur; // keep at least one
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const load = useCallback(async (id: PresetId, fresh = false) => {
    const mine = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = rangeFor(id);
      const res = await fetch(`/api/orders?from=${from}&to=${to}${fresh ? "&fresh=1" : ""}`);
      const body = await res.json();
      if (mine !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(body.error || "Request failed");
      setRows(body.rows);
      setFetchedAt(body.fetchedAt);
      setPage(0);
    } catch (e) {
      if (mine !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setRows([]);
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(preset);
  }, [preset, load]);

  // Close the Columns menu on outside click.
  useEffect(() => {
    if (!colMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colMenu]);

  const shownCols = useMemo(() => COLUMNS.filter((c) => visible.includes(c.key)), [visible]);

  // Search covers every column (not just visible ones), matching how the sheet's filter behaved.
  const haystacks = useMemo(
    () => rows.map((r) => COLUMNS.map((c, i) => formatCell(c, r[i]) + " " + (r[i] ?? "")).join(" ").toLowerCase()),
    [rows]
  );

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    let idx = rows.map((_, i) => i);
    if (q) idx = idx.filter((i) => haystacks[i].includes(q));
    if (sort) {
      const ci = COLUMNS.findIndex((c) => c.key === sort.key);
      const col = COLUMNS[ci];
      idx = [...idx].sort((a, b) => sort.dir * compare(col, rows[a][ci], rows[b][ci]));
    }
    return idx;
  }, [rows, haystacks, query, sort]);

  const pageCount = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = view.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const onSort = (key: string) =>
    setSort((cur) => (cur?.key === key ? (cur.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      <div className="page-head">
        <div>
          <div className="page-title">Assisted Orders</div>
          <div className="page-sub">
            {loading ? "Loading orders…" : `${view.length.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} orders`}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <span className="ico">⌕</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by order no., customer, sales person, ticket…"
          />
        </div>
        <button type="button" className="btn-tool" disabled={loading} onClick={() => load(preset, true)}>
          ↻ Refresh
        </button>
        <div className="pop-wrap" ref={menuRef}>
          <button type="button" className={`btn-tool ${colMenu ? "on" : ""}`} onClick={() => setColMenu((o) => !o)}>
            ☰ Columns
          </button>
          {colMenu && (
            <div className="pop">
              <div className="pop-h">Columns shown</div>
              {COLUMNS.map((c) => (
                <button type="button" key={c.key} className="pop-item" onClick={() => toggleColumn(c.key)}>
                  <span>{c.label}</span>
                  <span className="chk">{visible.includes(c.key) ? "✓" : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`tab ${preset === p.id ? "sel" : ""}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skel" style={{ width: `${70 + ((i * 13) % 28)}%` }} />
          ))}
        </div>
      ) : !error && view.length === 0 ? (
        <div className="empty-box">
          <div className="t">{rows.length === 0 ? "No orders in this range" : "Nothing matches your search"}</div>
          <div className="b">
            {rows.length === 0 ? "Try a wider date range." : "Try a different keyword, or clear the search box."}
          </div>
        </div>
      ) : (
        !error && (
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
                        const v = rows[ri][COLUMNS.indexOf(c)];
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
        )
      )}

      {fetchedAt && !loading && (
        <div className="foot-note">
          Data as of {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. Refresh to
          re-run the view.
        </div>
      )}
    </div>
  );
}
