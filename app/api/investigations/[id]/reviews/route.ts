import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getBigQuery, getSchema, reviewTable } from "@/lib/bigquery";
import { plain, type Cell } from "@/lib/bqvalue";
import { caseKey, findInvestigation } from "@/lib/investigations";
import { buildAlterSql, buildInsert, buildUpdate, validateFields } from "@/lib/reviews";
import { flaggedCache } from "@/lib/serverCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

async function authed() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

/** Runs a DML statement and returns how many rows it changed. */
async function runDml(query: string, params: Record<string, unknown>, types: Record<string, string>): Promise<number> {
  const [job] = await getBigQuery().createQueryJob({ query, params, types });
  await job.getQueryResults();
  const [meta] = await job.getMetadata();
  return Number(meta.statistics?.query?.numDmlAffectedRows ?? 0);
}

/** All reviewed cases of one investigation: columns come from the table itself, so new columns just appear. */
export async function GET(_req: Request, { params }: Ctx) {
  if (!(await authed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inv = findInvestigation(params.id);
  if (!inv) return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });

  try {
    const [fields, [rows]] = await Promise.all([
      getSchema("order_verification", inv.table),
      getBigQuery().query({ query: `SELECT * FROM ${reviewTable(inv.table)} ORDER BY updated_at DESC` })
    ]);
    const shown = fields.filter((f) => f.name !== "case_key");
    return NextResponse.json({
      columns: shown.map((f) => ({ key: f.name, type: f.type })),
      rows: rows.map((r: Record<string, unknown>) => shown.map((f) => plain(r[f.name]))),
      caseKeys: rows.map((r: Record<string, unknown>) => String(r.case_key ?? "")),
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`reviews list ${inv.id} failed`, err);
    return NextResponse.json({ error: "Could not load reviewed cases." }, { status: 500 });
  }
}

/** Save a flagged case: stores the full record + the four fields, which makes the view stop flagging it. */
export async function POST(req: Request, { params }: Ctx) {
  const email = await authed();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inv = findInvestigation(params.id);
  if (!inv) return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const checked = validateFields(body?.fields);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const record = body?.record as Record<string, Cell> | undefined;
  if (!record || typeof record !== "object") return NextResponse.json({ error: "Missing record." }, { status: 400 });
  const key = caseKey(inv, record);
  if (!key.replace(/\|/g, "")) return NextResponse.json({ error: "Record has no order number." }, { status: 400 });

  try {
    const [viewFields, tableFields] = await Promise.all([
      getSchema("order_verification", inv.view),
      getSchema("order_verification", inv.table)
    ]);
    // A column added to the view later is added to the review table here, so the full record is always stored.
    const alter = buildAlterSql(inv, viewFields, tableFields);
    if (alter) await getBigQuery().query({ query: alter });

    const { query, params: p, types } = buildInsert(inv, viewFields, record, checked.fields, email);
    const changed = await runDml(query, p, types);
    flaggedCache.delete(inv.id);
    if (changed === 0) {
      return NextResponse.json({ error: "This case has already been reviewed by someone else." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`review save ${inv.id} failed`, err);
    return NextResponse.json({ error: "Could not save the review. Nothing was changed." }, { status: 500 });
  }
}

/** Edit the four fields of an already-saved case. */
export async function PUT(req: Request, { params }: Ctx) {
  const email = await authed();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inv = findInvestigation(params.id);
  if (!inv) return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const checked = validateFields(body?.fields);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const key = typeof body?.caseKey === "string" ? body.caseKey : "";
  if (!key) return NextResponse.json({ error: "Missing case." }, { status: 400 });

  try {
    const { query, params: p, types } = buildUpdate(inv, key, checked.fields, email);
    const changed = await runDml(query, p, types);
    if (changed === 0) return NextResponse.json({ error: "That case no longer exists." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`review edit ${inv.id} failed`, err);
    return NextResponse.json({ error: "Could not save your changes." }, { status: 500 });
  }
}
