"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLUMNS, resolveCol, type Col } from "@/lib/columns";
import { formatCell, isoDay } from "@/lib/format";
import type { Cell } from "@/lib/bqvalue";
import DataTable from "./DataTable";

const VIEW_START = "2025-07-01"; // the view's own floor

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

const DATE_COL = { key: "", label: "", type: "date" } as const;

/** "01 Sep 2026 – 06 Oct 2026", so it's explicit which dates a preset covers. */
function rangeLabel(id: PresetId): string {
  const { from, to } = rangeFor(id);
  return `${formatCell(DATE_COL, from)} – ${formatCell(DATE_COL, to)}`;
}

/** Known columns not marked `def` start hidden; anything new in the view starts visible. */
const DEFAULT_HIDDEN = COLUMNS.filter((c) => !c.def).map((c) => c.key);

export default function OrdersTable() {
  const [preset, setPreset] = useState<PresetId>("30");
  const [cols, setCols] = useState<Col[]>([]);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const reqId = useRef(0);

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
      setCols((body.columns as { key: string; type: string }[]).map((c) => resolveCol(c.key, c.type)));
      setRows(body.rows);
      setFetchedAt(body.fetchedAt);
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

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      <div className="page-head">
        <div>
          <div className="page-title">Assisted Orders</div>
          <div className="page-sub">
            {loading ? "Loading orders…" : `${rows.length.toLocaleString("en-IN")} orders · ${rangeLabel(preset)}`}
          </div>
        </div>
      </div>

      <div className="tabs">
        <span className="tabs-label">Order date</span>
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
      ) : !error && rows.length === 0 ? (
        <div className="empty-box">
          <div className="t">No orders in this range</div>
          <div className="b">Try a wider date range.</div>
        </div>
      ) : (
        !error && (
          <DataTable
            cols={cols}
            rows={rows}
            storageKey="ov.orders.hidden"
            defaultHidden={DEFAULT_HIDDEN}
            searchPlaceholder="Search by order no., customer, sales person, ticket…"
            tools={
              <button type="button" className="btn-tool" onClick={() => load(preset, true)}>
                ↻ Refresh
              </button>
            }
          />
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
