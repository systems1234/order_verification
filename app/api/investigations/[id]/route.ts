import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBigQuery, investigationView } from "@/lib/bigquery";
import { plain, type Cell } from "@/lib/bqvalue";
import { findInvestigation } from "@/lib/investigations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 5 * 60 * 1000;

interface Payload {
  columns: { key: string; type: string }[];
  rows: Cell[][];
  fetchedAt: string;
}

/** Every investigation re-runs the heavy base view, so cache per case for a few minutes. */
const cache = new Map<string, { at: number; payload: Payload }>();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only registry entries are queryable: the id is never interpolated into SQL.
  const inv = findInvestigation(params.id);
  if (!inv) return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });

  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const hit = cache.get(inv.id);
  if (hit && !fresh && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true });
  }

  try {
    const bq = getBigQuery();
    const dataset = bq.dataset("order_verification");
    // Schema comes from table metadata so an empty result (good news) still has its columns.
    const [[rows], [meta]] = await Promise.all([
      bq.query({ query: `SELECT * FROM ${investigationView(inv.view)} ORDER BY ${inv.orderBy}` }),
      dataset.table(inv.view).getMetadata()
    ]);
    const fields: { name: string; type: string }[] = meta.schema?.fields ?? [];
    const payload: Payload = {
      columns: fields.map((f) => ({ key: f.name, type: f.type })),
      rows: rows.map((r: Record<string, unknown>) => fields.map((f) => plain(r[f.name]))),
      fetchedAt: new Date().toISOString()
    };
    cache.set(inv.id, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error(`investigation ${inv.id} failed`, err);
    return NextResponse.json({ error: "Could not load this investigation from BigQuery." }, { status: 500 });
  }
}
