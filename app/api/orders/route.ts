import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBigQuery, getSchema, ordersView, ordersViewId, parseTableId } from "@/lib/bigquery";
import { plain, type Cell } from "@/lib/bqvalue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface Payload {
  columns: { key: string; type: string }[];
  rows: Cell[][];
  fetchedAt: string;
}

/**
 * The view fans out across ~20 joins, so every run is slow and billable. Cache per
 * date range for a few minutes (per warm instance); "Refresh" in the UI sends fresh=1.
 */
const cache = new Map<string, { at: number; payload: Payload }>();

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
    const { dataset, table } = parseTableId(ordersViewId());
    // SELECT * + live schema: a column added to the view appears in the app immediately.
    const [[rows], fields] = await Promise.all([
      getBigQuery().query({
        query: `
          SELECT *
          FROM ${ordersView()}
          WHERE \`date\` BETWEEN DATE '${from}' AND DATE '${to}'
          ORDER BY \`date\` DESC
        `
      }),
      getSchema(dataset, table)
    ]);
    const payload: Payload = {
      columns: fields.map((f) => ({ key: f.name, type: f.type })),
      rows: rows.map((r: Record<string, unknown>) => fields.map((f) => plain(r[f.name]))),
      fetchedAt: new Date().toISOString()
    };
    cache.set(key, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error("orders query failed", err);
    return NextResponse.json({ error: "Could not load orders from BigQuery." }, { status: 500 });
  }
}
