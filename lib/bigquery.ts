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
  return `\`${process.env.ORDERS_VIEW_ID || "mis-gempundit.order_verification.assited_orders_for_verification"}\``;
}

/** HR's employee directory; sign-in is gated on Project_id here. */
export function employeeTable(): string {
  return `\`${process.env.EMPLOYEE_DATA_TABLE_ID || "mis-gempundit.gempundit_db.employee"}\``;
}

/** Fully-qualified, backtick-quoted investigation view. `view` must come from the INVESTIGATIONS registry. */
export function investigationView(view: string): string {
  return `\`${process.env.GCP_PROJECT_ID || "mis-gempundit"}.order_verification.${view}\``;
}
