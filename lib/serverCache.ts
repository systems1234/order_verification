import type { Cell } from "./bqvalue";

export interface FlaggedPayload {
  columns: { key: string; type: string }[];
  rows: Cell[][];
  fetchedAt: string;
  /** Last refresh of the snapshot the case reads from; null for cases that query live data. */
  refreshedAt: string | null;
}

/** Per-instance cache of flagged results (each one re-runs the heavy base view). Cleared when a case is reviewed. */
export const flaggedCache = new Map<string, { at: number; payload: FlaggedPayload }>();
