import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBigQuery, ordersView } from "@/lib/bigquery";
import { COLUMNS } from "@/lib/columns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;

type Cell = string | number | boolean | null;
interface Payload {
  rows: Cell[][];
  fetchedAt: string;
}

/**
 * The view fans out across ~20 joins, so every run is slow and billable. Cache per
 * date range for a few minutes (per warm instance); "Refresh" in the UI sends fresh=1.
 */
const cache = new Map<string, { at: number; payload: Payload }>();

/** BigQuery wraps DATE / TIMESTAMP / DATETIME values as { value: string }. */
function plain(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return String((v as { value?: unknown }).value ?? "");
  return v as Cell;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const key = `${from}|${to}`;
  const hit = cache.get(key);
  if (hit && url.searchParams.get("fresh") !== "1" && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true });
  }

  try {
    // from/to are strictly YYYY-MM-DD (validated above), so inlining them as DATE literals is injection-safe.
    // Typed query parameters silently matched zero rows against this view.
    const select = COLUMNS.map((c) => `\`${c.key}\``).join(", ");
    const [rows] = await getBigQuery().query({
      query: `
        SELECT ${select}
        FROM ${ordersView()}
        WHERE \`date\` BETWEEN DATE '${from}' AND DATE '${to}'
        ORDER BY \`date\` DESC, sales_person ASC
      `
    });
    const payload: Payload = {
      rows: rows.map((r: Record<string, unknown>) => COLUMNS.map((c) => plain(r[c.key]))),
      fetchedAt: new Date().toISOString()
    };
    cache.set(key, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error("orders query failed", err);
    return NextResponse.json({ error: "Could not load orders from BigQuery." }, { status: 500 });
  }
}
