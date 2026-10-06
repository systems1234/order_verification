"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveCol, type Col } from "@/lib/columns";
import { INVESTIGATIONS } from "@/lib/investigations";
import type { Cell } from "@/lib/bqvalue";
import DataTable from "./DataTable";

interface Result {
  cols: Col[];
  rows: Cell[][];
  fetchedAt: string;
}

/** How many investigations "Count all" runs at once; each one re-runs the heavy base view. */
const COUNT_ALL_CONCURRENCY = 2;

export default function InvestigationsView() {
  const [activeId, setActiveId] = useState(INVESTIGATIONS[0].id);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [countingAll, setCountingAll] = useState(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const inFlight = useRef(new Set<string>());

  const load = useCallback(async (id: string, fresh = false) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setLoading((s) => new Set(s).add(id));
    setErrors((e) => {
      const { [id]: _drop, ...rest } = e;
      return rest;
    });
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}${fresh ? "?fresh=1" : ""}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Request failed");
      const cols = (body.columns as { key: string; type: string }[]).map((c) => resolveCol(c.key, c.type));
      setResults((r) => ({ ...r, [id]: { cols, rows: body.rows, fetchedAt: body.fetchedAt } }));
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: e instanceof Error ? e.message : "Something went wrong." }));
    } finally {
      inFlight.current.delete(id);
      setLoading((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }, []);

  // Load the selected case the first time it's opened.
  useEffect(() => {
    if (!resultsRef.current[activeId]) load(activeId);
  }, [activeId, load]);

  const countAll = async () => {
    setCountingAll(true);
    const queue = INVESTIGATIONS.map((i) => i.id).filter((id) => !resultsRef.current[id]);
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) await load(id);
    };
    await Promise.all(Array.from({ length: COUNT_ALL_CONCURRENCY }, worker));
    setCountingAll(false);
  };

  const active = INVESTIGATIONS.find((i) => i.id === activeId)!;
  const result = results[activeId];
  const isLoading = loading.has(activeId);
  const error = errors[activeId];

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      <div className="page-head">
        <div>
          <div className="page-title">Investigations</div>
          <div className="page-sub">
            {INVESTIGATIONS.length} cases · counts appear once a case has been opened
          </div>
        </div>
        <button type="button" className="btn-tool" disabled={countingAll} onClick={countAll}>
          {countingAll ? "Counting…" : "Count all"}
        </button>
      </div>

      <div className="tabs">
        {INVESTIGATIONS.map((i) => {
          const r = results[i.id];
          return (
            <button
              type="button"
              key={i.id}
              className={`tab ${activeId === i.id ? "sel" : ""}`}
              onClick={() => setActiveId(i.id)}
            >
              {i.title}
              {r ? <span className="count">{r.rows.length.toLocaleString("en-IN")}</span> : null}
              {errors[i.id] ? <span className="count err">!</span> : null}
            </button>
          );
        })}
      </div>

      <div className="case-note">{active.desc}</div>

      {error && (
        <div className="error-box">
          {error}{" "}
          <button type="button" className="link-btn" onClick={() => load(activeId, true)}>
            Try again
          </button>
        </div>
      )}

      {isLoading && !result ? (
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel" style={{ width: `${70 + ((i * 13) % 28)}%` }} />
          ))}
        </div>
      ) : result ? (
        result.rows.length === 0 ? (
          <div className="empty-box">
            <div className="t">No orders match {active.title}</div>
            <div className="b">Nothing to investigate right now.</div>
          </div>
        ) : (
          <DataTable
            key={activeId}
            cols={result.cols}
            rows={result.rows}
            storageKey={`ov.inv.${activeId}.columns`}
            searchPlaceholder="Search this investigation…"
            tools={
              <button type="button" className="btn-tool" disabled={isLoading} onClick={() => load(activeId, true)}>
                ↻ Refresh
              </button>
            }
          />
        )
      ) : null}

      {result && !isLoading && (
        <div className="foot-note">
          {result.rows.length.toLocaleString("en-IN")} {result.rows.length === 1 ? "order" : "orders"} · as of{" "}
          {new Date(result.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
        </div>
      )}
    </div>
  );
}
