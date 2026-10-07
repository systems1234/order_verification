import { BigQuery } from "@google-cloud/bigquery";

let client: BigQuery | null = null;

/** Server-side only. Credentials come from GCP_SERVICE_ACCOUNT_KEY (full JSON string). */
export function getBigQuery(): BigQuery {
  if (client) return client;

  const rawKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");

  client = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || "mis-gempundit",
    credentials: JSON.parse(rawKey),
    // Pinned: the view spans several datasets and per-job location inference is unreliable.
    location: process.env.BIGQUERY_LOCATION || "asia-south2",
    // Drive scope: some source tables behind the view are Sheet-backed external tables.
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });
  return client;
}

/** Fully-qualified, backtick-quoted view the Assisted Orders tab reads from. */
export function ordersView(): string {
  return `\`${ordersViewId()}\``;
}

/** HR's employee directory; sign-in is gated on Project_id here. */
export function employeeTable(): string {
  return `\`${process.env.EMPLOYEE_DATA_TABLE_ID || "mis-gempundit.gempundit_db.employee"}\``;
}

/** Fully-qualified, backtick-quoted investigation view. `view` must come from the INVESTIGATIONS registry. */
export function investigationView(view: string): string {
  return `\`${process.env.GCP_PROJECT_ID || "mis-gempundit"}.order_verification.${view}\``;
}

/** Fully-qualified, backtick-quoted review table. `table` must come from the INVESTIGATIONS registry. */
export function reviewTable(table: string): string {
  return `\`${process.env.GCP_PROJECT_ID || "mis-gempundit"}.order_verification.${table}\``;
}

export interface SchemaField {
  name: string;
  type: string;
}

/** Column names + BigQuery types of a table or view, read live so new columns show up immediately. */
export async function getSchema(dataset: string, table: string): Promise<SchemaField[]> {
  const [meta] = await getBigQuery().dataset(dataset).table(table).getMetadata();
  return (meta.schema?.fields ?? []).map((f: { name: string; type: string }) => ({ name: f.name, type: f.type }));
}

/** Splits "project.dataset.table" (as configured in ORDERS_VIEW_ID). */
export function parseTableId(id: string): { dataset: string; table: string } {
  const parts = id.split(".");
  return { dataset: parts[parts.length - 2], table: parts[parts.length - 1] };
}

export function ordersViewId(): string {
  // Default = the snapshot table, refreshed weekly from the heavy assited_orders_for_verification view.
  return process.env.ORDERS_VIEW_ID || "mis-gempundit.order_verification.assited_orders_for_verification_snapshot";
}

/** Schema plus last-modified time (ISO) of a table: for a snapshot table that is when it was last refreshed. */
export async function getTableInfo(dataset: string, table: string): Promise<{ fields: SchemaField[]; lastModified: string | null }> {
  const [meta] = await getBigQuery().dataset(dataset).table(table).getMetadata();
  const ms = Number(meta.lastModifiedTime);
  return {
    fields: (meta.schema?.fields ?? []).map((f: { name: string; type: string }) => ({ name: f.name, type: f.type })),
    lastModified: Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null
  };
}
