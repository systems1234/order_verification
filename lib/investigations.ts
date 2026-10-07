/** Investigation cases. Each one is a BigQuery view in the order_verification dataset (sql/investigations.sql)
 *  with a matching review table (sql/investigation_reviews.sql). Safe to import from client code. */
export type InvestigationGroup = "order" | "lead";

export interface Investigation {
  id: string;
  /** Which tab the case belongs to. */
  group: InvestigationGroup;
  /** View name inside the order_verification dataset. */
  view: string;
  /** Review table holding the saved cases (auditor decisions) for this investigation. */
  table: string;
  title: string;
  desc: string;
  /** Trusted constant appended as ORDER BY by the API route. */
  orderBy: string;
  /**
   * Columns identifying a case; their values joined with '|' form case_key (must match the view's NOT EXISTS).
   * "col:date" uses only the UTC date of a timestamp column (timestamps themselves lose precision in the API).
   */
  keyCols: string[];
}

export const INVESTIGATIONS: Investigation[] = [
  { id: "1.1", group: "order", view: "inv_1_1", table: "inv_1_1_reviews", title: "#1.1", desc: "COD · no frontend user · not COD-30 · ticket created after the 02 Pending Approval step · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "1.2", group: "order", view: "inv_1_2", table: "inv_1_2_reviews", title: "#1.2", desc: "COD · no frontend user · not COD-30 · ticket created less than 30 min before 02 Pending Approval", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "1.2.1", group: "order", view: "inv_1_2_1", table: "inv_1_2_1_reviews", title: "#1.2.1", desc: "COD · not COD-30 · first connect before order approval · ticket created less than 30 min before 02 Pending Approval · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "1.3", group: "order", view: "inv_1_3", table: "inv_1_3_reviews", title: "#1.3", desc: "COD · not COD-30 · first connect before order approval · ticket created more than 30 min before 02 Pending Approval · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "1.4", group: "order", view: "inv_1_4", table: "inv_1_4_reviews", title: "#1.4", desc: "COD · no frontend user · COD-30 orders under ₹1,00,000 · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "1.41", group: "order", view: "inv_1_41", table: "inv_1_41_reviews", title: "#1.41", desc: "COD · no frontend user · total under ₹50,000", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "2", group: "order", view: "inv_2", table: "inv_2_reviews", title: "#2", desc: "CHQ ticket · no frontend user · first connect after order approval · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "3", group: "order", view: "inv_3", table: "inv_3_reviews", title: "#3", desc: "Order amount above the team-wise limit (flagged Investigate) · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "6", group: "order", view: "inv_6", table: "inv_6_reviews", title: "#6", desc: "CHQ ticket · invoice not Paid · order Cancelled / Closed · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "7", group: "order", view: "inv_7", table: "inv_7_reviews", title: "#7", desc: "CHQ ticket · invoice not Paid · live order approved 60+ days ago · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "9", group: "order", view: "inv_9", table: "inv_9_reviews", title: "#9", desc: "CHQ ticket · no frontend user · order phone differs from lead phone · since 1 Jan 2026", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "10", group: "order", view: "inv_10", table: "inv_10_reviews", title: "#10", desc: "CHQ ticket ID present but no ticket-created time", orderBy: "order_date_time ASC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "11", group: "order", view: "inv_11", table: "inv_11_reviews", title: "#11", desc: "Unassisted orders with a test / employee name (test, Test, Pawan, Ankit) · since 1 Jan 2026", orderBy: "purchase_date ASC", keyCols: ["oldest_order_number", "newest_order_number"] },
  { id: "14", group: "order", view: "inv_14", table: "inv_14_reviews", title: "#14", desc: "Order's sales team differs from the team assigned by lead budget · since 1 May 2026", orderBy: "order_date_time DESC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "15", group: "order", view: "inv_15", table: "inv_15_reviews", title: "#15", desc: "Invalid sales team flagged · since 1 May 2026", orderBy: "order_date_time DESC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "16", group: "order", view: "inv_16", table: "inv_16_reviews", title: "#16", desc: "Lead created more than 90 days away from the order date · since 1 Jan 2026", orderBy: "order_date_time DESC", keyCols: ["oldest_order_number", "newest_order_no", "sales_person"] },
  { id: "L1", group: "lead", view: "lead_investigation_1", table: "lead_investigation_1_reviews", title: "Lead #1", desc: "Leads closed and then reopened more than 60 days later", orderBy: "next_state_updatedAt DESC", keyCols: ["lead_id", "closed_at:date"] },
  { id: "L2", group: "lead", view: "lead_investigation_2", table: "lead_investigation_2_reviews", title: "Lead #2", desc: "Lead assigned to several agents: the first agent matched the budget category, every later one did not", orderBy: "lead_id ASC", keyCols: ["lead_id"] }
];

export function findInvestigation(id: string): Investigation | undefined {
  return INVESTIGATIONS.find((i) => i.id === id);
}

export function investigationsIn(group: InvestigationGroup): Investigation[] {
  return INVESTIGATIONS.filter((i) => i.group === group);
}

/** Case key for a record: must stay identical to the key expression in the view's NOT EXISTS clause. */
export function caseKey(inv: Investigation, record: Record<string, string | number | boolean | null | undefined>): string {
  return inv.keyCols
    .map((spec) => {
      const [col, as] = spec.split(":");
      const v = record[col];
      if (v === null || v === undefined) return "";
      return as === "date" ? String(v).slice(0, 10) : String(v);
    })
    .join("|");
}
