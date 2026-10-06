import type { Col } from "./columns";

type Cell = string | number | boolean | null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-01" -> "01 Sep 2026" */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** DATETIME has no timezone: "2026-09-01T10:05:00" -> "01 Sep 2026, 10:05" */
function fmtDatetime(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(iso);
  return m ? `${fmtDate(m[1])}, ${m[2]}` : iso;
}

const tsFmt = new Intl.DateTimeFormat("en-GB", {
  // The view's TIMESTAMP columns hold the IST wall-clock time labelled as UTC (13:54 UTC == 13:54 on the
  // sheet), so format them as UTC. Converting to Asia/Kolkata would add 5h30 that isn't real.
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

/** TIMESTAMP: shown exactly as stored (already IST wall-clock, see tsFmt). */
function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(tsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

const moneyFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Plain-text rendering of a cell (also used for search). Booleans/flags are handled by the caller. */
export function formatCell(col: Col, v: Cell): string {
  if (v === null || v === "") return "";
  switch (col.type) {
    case "date":
      return fmtDate(String(v));
    case "datetime":
      return fmtDatetime(String(v));
    case "timestamp":
      return fmtTimestamp(String(v));
    case "money":
      return `₹${moneyFmt.format(Number(v))}`;
    case "num":
    case "int":
      return moneyFmt.format(Number(v));
    case "bool":
      return v ? "TRUE" : "FALSE";
    default:
      return String(v);
  }
}

/** Local-time YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
