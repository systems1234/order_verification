"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { resolveCol, type Col } from "@/lib/columns";
import { formatCell } from "@/lib/format";
import { investigationsIn, type Investigation, type InvestigationGroup } from "@/lib/investigations";
import type { Cell } from "@/lib/bqvalue";
import DataTable from "./DataTable";
import ReviewModal, { type ReviewFieldValues } from "./ReviewModal";

interface Flagged {
  cols: Col[];
  rows: Cell[][];
  fetchedAt: string;
  /** Last refresh of the snapshot behind this case (order cases only). */
  refreshedAt: string | null;
}

interface Reviewed {
  cols: Col[];
  rows: Cell[][];
  /** case_key of each row, aligned with `rows` (the key column itself is hidden from the table). */
  caseKeys: string[];
  fetchedAt: string;
}

/** How many cases are loaded at once when counting every case. */
const COUNT_ALL_CONCURRENCY = 3;
const INSTANT_COL: Col = { key: "", label: "", type: "instant" };

const AUDIT_FIELDS = ["auditor", "decision_types", "decided_sales_person", "comments"];
const AUDIT_META = ["created_by", "created_at", "updated_by", "updated_at"];
const SUMMARY_KEYS = ["lead_id", "oldest_order_number", "sales_person", "customer_name", "total_amount", "amount", "tickets_id", "assignedTo", "first_assignee", "expected_category"];
/** Other columns whose values make good suggestions for "Decided sales person". */
const PERSON_KEYS = ["sales_person", "assignedTo", "first_assignee"];

/** Reviewed table order: case identity first, then the audit fields, then the rest, then who/when. */
function orderReviewed(cols: Col[], rows: Cell[][]): { cols: Col[]; rows: Cell[][] } {
  const rank = (c: Col) => {
    if (c.key === "oldest_order_number") return 0;
    if (c.key === "sales_person") return 1;
    const a = AUDIT_FIELDS.indexOf(c.key);
    if (a >= 0) return 2 + a;
    const m = AUDIT_META.indexOf(c.key);
    if (m >= 0) return 1000 + m;
    return 100;
  };
  const idx = cols.map((_, i) => i).sort((x, y) => rank(cols[x]) - rank(cols[y]) || x - y);
  return { cols: idx.map((i) => cols[i]), rows: rows.map((r) => idx.map((i) => r[i])) };
}

type Modal = { mode: "create" | "edit"; index: number } | null;

export default function InvestigationsView({ group, heading }: { group: InvestigationGroup; heading: string }) {
  const { data: session } = useSession();
  const cases = useMemo(() => investigationsIn(group), [group]);
  const [activeId, setActiveId] = useState(cases[0].id);
  const [tab, setTab] = useState<"flagged" | "reviewed">("flagged");
  const [flagged, setFlagged] = useState<Record<string, Flagged>>({});
  const [reviewed, setReviewed] = useState<Record<string, Reviewed>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [countingAll, setCountingAll] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; kind: "ok" | "warn" } | null>(null);
  const flaggedRef = useRef(flagged);
  flaggedRef.current = flagged;
  const reviewedRef = useRef(reviewed);
  reviewedRef.current = reviewed;
  const inFlight = useRef(new Set<string>());

  const active = cases.find((i) => i.id === activeId) as Investigation;

  const run = useCallback(async (flightKey: string, work: () => Promise<void>) => {
    if (inFlight.current.has(flightKey)) return;
    inFlight.current.add(flightKey);
    setLoading((s) => new Set(s).add(flightKey));
    setErrors((e) => {
      const { [flightKey]: _drop, ...rest } = e;
      return rest;
    });
    try {
      await work();
    } catch (e) {
      setErrors((er) => ({ ...er, [flightKey]: e instanceof Error ? e.message : "Something went wrong." }));
    } finally {
      inFlight.current.delete(flightKey);
      setLoading((s) => {
        const n = new Set(s);
        n.delete(flightKey);
        return n;
      });
    }
  }, []);

  const loadFlagged = useCallback(
    (id: string, fresh = false) =>
      run(id, async () => {
        const res = await fetch(`/api/investigations/${encodeURIComponent(id)}${fresh ? "?fresh=1" : ""}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Request failed");
        const cols = (body.columns as { key: string; type: string }[]).map((c) => resolveCol(c.key, c.type));
        setFlagged((r) => ({ ...r, [id]: { cols, rows: body.rows, fetchedAt: body.fetchedAt, refreshedAt: body.refreshedAt ?? null } }));
      }),
    [run]
  );

  const loadReviewed = useCallback(
    (id: string) =>
      run(`${id}:reviewed`, async () => {
        const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/reviews`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Request failed");
        const raw = (body.columns as { key: string; type: string }[]).map((c) => resolveCol(c.key, c.type));
        const ordered = orderReviewed(raw, body.rows);
        // caseKeys follow the original row order, which orderReviewed preserves.
        setReviewed((r) => ({ ...r, [id]: { ...ordered, caseKeys: body.caseKeys, fetchedAt: body.fetchedAt } }));
      }),
    [run]
  );

  // Load the selected case's data the first time each tab is opened.
  useEffect(() => {
    if (tab === "flagged" && !flaggedRef.current[activeId]) loadFlagged(activeId);
    if (tab === "reviewed" && !reviewedRef.current[activeId]) loadReviewed(activeId);
  }, [activeId, tab, loadFlagged, loadReviewed]);

  /** Loads every case (skipping ones already loaded unless `fresh`) so each chip shows its count. */
  const countAll = useCallback(
    async (fresh = false) => {
      setCountingAll(true);
      const queue = cases.map((i) => i.id).filter((id) => fresh || !flaggedRef.current[id]);
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) await loadFlagged(id, fresh);
      };
      await Promise.all(Array.from({ length: COUNT_ALL_CONCURRENCY }, worker));
      setCountingAll(false);
    },
    [cases, loadFlagged]
  );

  // Cases read from a small snapshot table now, so counting them all on arrival is cheap.
  useEffect(() => {
    countAll();
  }, [countAll]);

  const selectCase = (id: string) => {
    setNotice(null);
    setActiveId(id);
    setTab("flagged");
  };

  const flaggedResult = flagged[activeId];
  const reviewedResult = reviewed[activeId];
  const flaggedLoading = loading.has(activeId);
  const reviewedLoading = loading.has(`${activeId}:reviewed`);

  // Open modal (+ make sure suggestions from past reviews are available).
  const openModal = (m: NonNullable<Modal>) => {
    setSaveError(null);
    setModal(m);
    if (!reviewedRef.current[activeId]) loadReviewed(activeId);
  };

  const recordOf = (r: Flagged | Reviewed, index: number): Record<string, Cell> =>
    Object.fromEntries(r.cols.map((c, i) => [c.key, r.rows[index][i]]));

  /** Distinct non-empty values of a column, for the datalist suggestions. */
  const distinct = (r: { cols: Col[]; rows: Cell[][] } | undefined, key: string): string[] => {
    if (!r) return [];
    const i = r.cols.findIndex((c) => c.key === key);
    if (i < 0) return [];
    return Array.from(new Set(r.rows.map((row) => row[i]).filter((v): v is string => typeof v === "string" && v !== ""))).sort();
  };

  const modalData = useMemo(() => {
    if (!modal) return null;
    const src = modal.mode === "create" ? flaggedResult : reviewedResult;
    if (!src || !src.rows[modal.index]) return null;
    const record = recordOf(src, modal.index);
    const keys = SUMMARY_KEYS.filter((k) => src.cols.some((c) => c.key === k)).slice(0, 4);
    // Too few well-known columns (e.g. a new view): pad with the first columns so the form always shows the case.
    const useKeys = [...keys, ...src.cols.map((c) => c.key).filter((k) => !keys.includes(k))].slice(0, keys.length >= 3 ? keys.length : 4);
    const summary = useKeys.map((k) => {
      const col = src.cols.find((c) => c.key === k) as Col;
      return { label: col.label, value: formatCell(col, record[k] ?? null) };
    });
    const str = (k: string) => (typeof record[k] === "string" ? (record[k] as string) : "");
    const initial: ReviewFieldValues =
      modal.mode === "create"
        ? { auditor: session?.user?.name ?? "", decision_types: "", decided_sales_person: "", comments: "" }
        : {
            auditor: str("auditor"),
            decision_types: str("decision_types"),
            decided_sales_person: str("decided_sales_person"),
            comments: str("comments")
          };
    return { record, summary, initial };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, flaggedResult, reviewedResult, session]);

  const save = async (values: ReviewFieldValues) => {
    if (!modal || !modalData) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.mode === "create") {
        const res = await fetch(`/api/investigations/${encodeURIComponent(activeId)}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: modalData.record, fields: values })
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok || res.status === 409) {
          // Either way the case is no longer flagged, so drop it from the list and close the form.
          const idx = modal.index;
          setFlagged((f) => ({ ...f, [activeId]: { ...f[activeId], rows: f[activeId].rows.filter((_, i) => i !== idx) } }));
          setReviewed((r) => {
            const { [activeId]: _drop, ...rest } = r; // refetched next time the Reviewed tab opens
            return rest;
          });
          setModal(null);
          setNotice(
            res.ok
              ? { text: "Review saved. The case has moved to Reviewed.", kind: "ok" }
              : { text: body.error || "This case was already reviewed.", kind: "warn" }
          );
          return;
        }
        throw new Error(body.error || "Could not save the review.");
      } else {
        const key = reviewedResult?.caseKeys[modal.index];
        const res = await fetch(`/api/investigations/${encodeURIComponent(activeId)}/reviews`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseKey: key, fields: values })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not save your changes.");
        await loadReviewed(activeId);
        setModal(null);
        setNotice({ text: "Changes saved.", kind: "ok" });
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const err = tab === "flagged" ? errors[activeId] : errors[`${activeId}:reviewed`];
  const retry = () => (tab === "flagged" ? loadFlagged(activeId, true) : loadReviewed(activeId));

  return (
    <div style={{ animation: "fadeUp .3s ease both" }}>
      <div className="page-head">
        <div>
          <div className="page-title">{heading}</div>
          <div className="page-sub">{cases.length} cases</div>
        </div>
        <button type="button" className="btn-tool" disabled={countingAll} onClick={() => countAll(true)}>
          {countingAll ? "Refreshing…" : "↻ Refresh all"}
        </button>
      </div>

      <div className="tabs">
        {cases.map((i) => {
          const r = flagged[i.id];
          return (
            <button type="button" key={i.id} className={`tab ${activeId === i.id ? "sel" : ""}`} onClick={() => selectCase(i.id)}>
              {i.title}
              {r ? <span className="count">{r.rows.length.toLocaleString("en-IN")}</span> : null}
              {errors[i.id] ? <span className="count err">!</span> : null}
            </button>
          );
        })}
      </div>

      <div className="case-note">{active.desc}</div>

      <div className="tabs sub">
        <button type="button" className={`tab ${tab === "flagged" ? "sel" : ""}`} onClick={() => setTab("flagged")}>
          Flagged
          {flaggedResult ? <span className="count">{flaggedResult.rows.length.toLocaleString("en-IN")}</span> : null}
        </button>
        <button type="button" className={`tab ${tab === "reviewed" ? "sel" : ""}`} onClick={() => setTab("reviewed")}>
          Reviewed
          {reviewedResult ? <span className="count">{reviewedResult.rows.length.toLocaleString("en-IN")}</span> : null}
        </button>
      </div>

      {notice && (
        <div className={notice.kind === "ok" ? "ok-box" : "warn-box"}>
          {notice.text}{" "}
          <button type="button" className="link-btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {err && (
        <div className="error-box">
          {err}{" "}
          <button type="button" className="link-btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {tab === "flagged" ? (
        flaggedLoading && !flaggedResult ? (
          <Skeleton />
        ) : flaggedResult ? (
          flaggedResult.rows.length === 0 ? (
            <div className="empty-box">
              <div className="t">No orders match {active.title}</div>
              <div className="b">Nothing to investigate right now.</div>
            </div>
          ) : (
            <DataTable
              key={`${activeId}:flagged`}
              cols={flaggedResult.cols}
              rows={flaggedResult.rows}
              storageKey={`ov.inv.${activeId}.hidden`}
              searchPlaceholder="Search this investigation…"
              rowAction={{
                header: "",
                render: (index) => (
                  <button type="button" className="btn-sm" onClick={() => openModal({ mode: "create", index })}>
                    Review
                  </button>
                )
              }}
              tools={
                <button type="button" className="btn-tool" disabled={flaggedLoading} onClick={() => loadFlagged(activeId, true)}>
                  ↻ Refresh
                </button>
              }
            />
          )
        ) : null
      ) : reviewedLoading && !reviewedResult ? (
        <Skeleton />
      ) : reviewedResult ? (
        reviewedResult.rows.length === 0 ? (
          <div className="empty-box">
            <div className="t">No reviewed cases yet</div>
            <div className="b">Cases you review from the Flagged tab are kept here, and you can edit them any time.</div>
          </div>
        ) : (
          <DataTable
            key={`${activeId}:reviewed`}
            cols={reviewedResult.cols}
            rows={reviewedResult.rows}
            storageKey={`ov.inv.${activeId}.reviewed.hidden`}
            searchPlaceholder="Search reviewed cases…"
            rowAction={{
              header: "",
              render: (index) => (
                <button type="button" className="btn-sm" onClick={() => openModal({ mode: "edit", index })}>
                  Edit
                </button>
              )
            }}
            tools={
              <button type="button" className="btn-tool" disabled={reviewedLoading} onClick={() => loadReviewed(activeId)}>
                ↻ Refresh
              </button>
            }
          />
        )
      ) : null}

      {tab === "flagged" && flaggedResult && !flaggedLoading && (
        <div className="foot-note">
          {flaggedResult.rows.length.toLocaleString("en-IN")} flagged
          {flaggedResult.refreshedAt ? ` · source data refreshed ${formatCell(INSTANT_COL, flaggedResult.refreshedAt)} (updates weekly)` : " · live data"}.
        </div>
      )}

      {modal && modalData && (
        <ReviewModal
          key={`${activeId}:${modal.mode}:${modal.index}`}
          mode={modal.mode}
          title={modal.mode === "create" ? `Review · ${active.title}` : `Edit review · ${active.title}`}
          summary={modalData.summary}
          initial={modalData.initial}
          decisionOptions={distinct(reviewedResult, "decision_types")}
          salesOptions={Array.from(
            new Set([...PERSON_KEYS.flatMap((k) => distinct(flaggedResult, k)), ...distinct(reviewedResult, "decided_sales_person")])
          ).sort()}
          saving={saving}
          error={saveError}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${70 + ((i * 13) % 28)}%` }} />
      ))}
    </div>
  );
}
