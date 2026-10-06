export type Cell = string | number | boolean | null;

/** BigQuery wraps DATE / TIMESTAMP / DATETIME values as { value: string }; flatten to a plain cell. */
export function plain(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return String((v as { value?: unknown }).value ?? "");
  return v as Cell;
}
