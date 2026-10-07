import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBigQuery, getSchema, getTableInfo, investigationView, ordersViewId, parseTableId } from "@/lib/bigquery";
import { plain } from "@/lib/bqvalue";
import { findInvestigation } from "@/lib/investigations";
import { flaggedCache, type FlaggedPayload } from "@/lib/serverCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only registry entries are queryable: the id is never interpolated into SQL.
  const inv = findInvestigation(params.id);
  if (!inv) return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });

  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const hit = flaggedCache.get(inv.id);
  if (hit && !fresh && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true });
  }

  try {
    // Schema is read live, so a column added to the view shows up immediately (and an empty result keeps its columns).
    const [[rows], fields, refreshedAt] = await Promise.all([
      getBigQuery().query({ query: `SELECT * FROM ${investigationView(inv.view)} ORDER BY ${inv.orderBy}` }),
      getSchema("order_verification", inv.view),
      // Order cases read the weekly snapshot, so say how old it is. Lead cases query live data.
      inv.group === "order"
        ? (({ dataset, table }) => getTableInfo(dataset, table).then((t) => t.lastModified))(parseTableId(ordersViewId()))
        : Promise.resolve(null)
    ]);
    const payload: FlaggedPayload = {
      columns: fields.map((f) => ({ key: f.name, type: f.type })),
      rows: rows.map((r: Record<string, unknown>) => fields.map((f) => plain(r[f.name]))),
      fetchedAt: new Date().toISOString(),
      refreshedAt
    };
    flaggedCache.set(inv.id, { at: Date.now(), payload });
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error(`investigation ${inv.id} failed`, err);
    return NextResponse.json({ error: "Could not load this investigation from BigQuery." }, { status: 500 });
  }
}
