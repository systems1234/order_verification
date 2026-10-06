/** Shared by the API route (select order) and the table (rendering). Order = view column order. */
export type ColType = "text" | "money" | "num" | "int" | "date" | "datetime" | "timestamp" | "bool" | "flag";

export interface Col {
  key: string;
  label: string;
  type: ColType;
  /** Shown by default; everything else is reachable through the Columns menu. */
  def?: boolean;
  /** Monospace (IDs / phone numbers). */
  mono?: boolean;
}

export const COLUMNS: Col[] = [
  { key: "order_date_time", label: "Order date & time", type: "timestamp" },
  { key: "date", label: "Date", type: "date", def: true },
  { key: "sales_person", label: "Sales person", type: "text", def: true },
  { key: "sharing_percentage", label: "Sharing %", type: "num" },
  { key: "amount_toward_sales_person", label: "Amount to sales person", type: "money" },
  { key: "customer_type", label: "Customer type", type: "text" },
  { key: "oldest_order_number", label: "Oldest order no.", type: "text", def: true, mono: true },
  { key: "customer_name", label: "Customer name", type: "text", def: true },
  { key: "status", label: "Status", type: "text" },
  { key: "current_order_status", label: "Current order status", type: "text", def: true },
  { key: "total_amount", label: "Total amount", type: "money", def: true },
  { key: "order_type_in_mtd_form", label: "Order type (MTD form)", type: "text" },
  { key: "newest_order_no", label: "Newest order no.", type: "text", def: true, mono: true },
  { key: "payment_method", label: "Payment method", type: "text" },
  { key: "tickets_id", label: "Ticket ID", type: "text", def: true, mono: true },
  { key: "approval_timestamp", label: "Approval time", type: "datetime" },
  { key: "mtd_form_filled_timestamp", label: "MTD form filled", type: "datetime" },
  { key: "total_metal_amt", label: "Total metal amt", type: "money" },
  { key: "ticket_id_text", label: "Ticket ID (text)", type: "text", mono: true },
  { key: "ticket_created_at", label: "Ticket created", type: "datetime" },
  { key: "invoice_status", label: "Invoice status", type: "text", def: true },
  { key: "lead_sources", label: "Lead source", type: "text", def: true },
  { key: "first_connected_time", label: "First connected", type: "datetime" },
  { key: "true_false", label: "Ticket after approval", type: "bool" },
  { key: "first_connect_time_true_false", label: "First connect after approval", type: "bool" },
  { key: "username_frontend", label: "Frontend username", type: "text" },
  { key: "team", label: "Team", type: "text", def: true },
  { key: "order_limit_team_wise_investigate", label: "Order limit (team-wise)", type: "flag", def: true },
  { key: "pending_approval_02_step_timestamp", label: "02 Pending approval", type: "datetime" },
  { key: "diff_min_ticket_created_vs_02_pending_approval", label: "Ticket → 02 pending (min)", type: "int" },
  { key: "true_false_02_vs_ticket_created_date", label: "Ticket after 02 pending", type: "bool" },
  { key: "diff_min_1st_connect_vs_10_order_approved", label: "1st connect → approved (min)", type: "int" },
  { key: "true_false_02_vs_1st_time_connect", label: "1st connect after 02 pending", type: "bool" },
  { key: "order_phone_number_1", label: "Order phone", type: "text", mono: true },
  { key: "lead_phone_number", label: "Lead phone", type: "text", mono: true },
  { key: "order_phone_ne_lead_phone", label: "Order phone = lead phone", type: "bool" },
  { key: "ticket_date_more_than_1_month_older_than_order_date", label: "Ticket >1 month older (days)", type: "int" },
  { key: "lead_source_for_sales_report_data_category_1", label: "Lead source cat. 1", type: "text" },
  { key: "lead_source_for_sales_report_data_category_2", label: "Lead source cat. 2", type: "text" },
  { key: "process_key", label: "Process key", type: "text", mono: true },
  { key: "assigned_to", label: "Assigned to", type: "text" },
  { key: "email_id", label: "Email", type: "text" },
  { key: "lead_created_at", label: "Lead created", type: "date" },
  { key: "budget", label: "Budget", type: "text" },
  { key: "helper_budget", label: "Helper budget", type: "int" },
  { key: "name_as_per_lead_budget", label: "Name as per lead budget", type: "text" },
  { key: "assigned_team_acc_to_budget", label: "Assigned team (budget)", type: "text" },
  { key: "final_assigned_to_name", label: "Final assigned to", type: "text", def: true },
  { key: "assigned_to_team", label: "Assigned to team", type: "text" },
  { key: "ticket_id_beyond_90_days", label: "Ticket beyond 90 days", type: "flag", mono: true },
  { key: "budget_team_mismatch_flag", label: "Budget / team mismatch", type: "flag", def: true },
  { key: "invalid_sales_team_flag", label: "Invalid sales team", type: "flag", def: true }
];

/** Labels/types for columns that only appear in the investigation views (e.g. the unassisted-orders view). */
const EXTRA: Record<string, Col> = {
  purchase_date: { key: "purchase_date", label: "Purchase date", type: "date" },
  amount: { key: "amount", label: "Amount", type: "money" },
  current_status: { key: "current_status", label: "Current status", type: "text" },
  newest_order_number: { key: "newest_order_number", label: "Newest order no.", type: "text", mono: true }
};

const BQ_TYPES: Record<string, ColType> = {
  TIMESTAMP: "timestamp",
  DATETIME: "datetime",
  DATE: "date",
  FLOAT: "num",
  FLOAT64: "num",
  INTEGER: "int",
  INT64: "int",
  BOOLEAN: "bool",
  BOOL: "bool"
};

/** Column definition for a result column: known labels first, then BigQuery's own type, then a humanised key. */
export function resolveCol(key: string, bqType: string): Col {
  const known = COLUMNS.find((c) => c.key === key) ?? EXTRA[key];
  if (known) return known;
  const label = key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return { key, label, type: BQ_TYPES[bqType] ?? "text" };
}
