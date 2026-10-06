"use client";

import { useEffect, useRef, useState } from "react";

export interface ReviewFieldValues {
  auditor: string;
  decision_types: string;
  decided_sales_person: string;
  comments: string;
}

interface Props {
  mode: "create" | "edit";
  title: string;
  /** Read-only facts about the case, shown above the form. */
  summary: { label: string; value: string }[];
  initial: ReviewFieldValues;
  /** Previously used values, offered as suggestions (free text is still allowed). */
  decisionOptions: string[];
  salesOptions: string[];
  saving: boolean;
  error: string | null;
  onSave: (values: ReviewFieldValues) => void;
  onClose: () => void;
}

export default function ReviewModal({
  mode,
  title,
  summary,
  initial,
  decisionOptions,
  salesOptions,
  saving,
  error,
  onSave,
  onClose
}: Props) {
  const [v, setV] = useState<ReviewFieldValues>(initial);
  const [touched, setTouched] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const set = (k: keyof ReviewFieldValues) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const missing = !v.auditor.trim() || !v.decision_types.trim();
  const submit = () => {
    setTouched(true);
    if (!missing) onSave(v);
  };

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-scrim" onClick={() => !saving && onClose()} />
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-x" aria-label="Close" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-sub">
          {mode === "create"
            ? "Saving stores this case with your decision and removes it from the flagged list."
            : "Update your decision or comments. The case details can't be changed."}
        </div>

        {summary.length > 0 && (
          <div className="facts">
            {summary.map((s) => (
              <div key={s.label} style={{ display: "contents" }}>
                <div className="facts-l">{s.label}</div>
                <div className="facts-v">{s.value || "—"}</div>
              </div>
            ))}
          </div>
        )}

        <label className="fld-l" htmlFor="rv-auditor">
          Auditor <span className="req">*</span>
        </label>
        <input
          id="rv-auditor"
          ref={first}
          className={`fld ${touched && !v.auditor.trim() ? "bad" : ""}`}
          value={v.auditor}
          onChange={set("auditor")}
          maxLength={200}
        />

        <label className="fld-l" htmlFor="rv-decision">
          Decision type <span className="req">*</span>
        </label>
        <input
          id="rv-decision"
          className={`fld ${touched && !v.decision_types.trim() ? "bad" : ""}`}
          value={v.decision_types}
          onChange={set("decision_types")}
          list="rv-decision-list"
          maxLength={200}
        />
        <datalist id="rv-decision-list">
          {decisionOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        <label className="fld-l" htmlFor="rv-sales">
          Decided sales person
        </label>
        <input
          id="rv-sales"
          className="fld"
          value={v.decided_sales_person}
          onChange={set("decided_sales_person")}
          list="rv-sales-list"
          maxLength={200}
        />
        <datalist id="rv-sales-list">
          {salesOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>

        <label className="fld-l" htmlFor="rv-comments">
          Comments
        </label>
        <textarea id="rv-comments" className="fld" rows={4} value={v.comments} onChange={set("comments")} maxLength={4000} />

        {touched && missing && <div className="modal-err">Auditor and decision type are required.</div>}
        {error && <div className="modal-err">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? "Saving…" : mode === "create" ? "Save review" : "Save changes"}
          </button>
          <button type="button" className="btn-sm" disabled={saving} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
