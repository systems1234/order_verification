/** Investigation cases. Each one is a BigQuery view in the order_verification dataset (see sql/investigations.sql).
 *  Safe to import from client code: contains no secrets and no server-only imports. */
export interface Investigation {
  id: string;
  /** View name inside the order_verification dataset. */
  view: string;
  title: string;
  desc: string;
  /** Trusted constant appended as ORDER BY by the API route. */
  orderBy: string;
}

export const INVESTIGATIONS: Investigation[] = [
  { id: "1.1", view: "inv_1_1", title: "#1.1", desc: "COD · no frontend user · not COD-30 · ticket created after the 02 Pending Approval step · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "1.2", view: "inv_1_2", title: "#1.2", desc: "COD · no frontend user · not COD-30 · ticket created less than 30 min before 02 Pending Approval", orderBy: "order_date_time ASC" },
  { id: "1.4", view: "inv_1_4", title: "#1.4", desc: "COD · no frontend user · COD-30 orders under ₹1,00,000 · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "1.41", view: "inv_1_41", title: "#1.41", desc: "COD · no frontend user · total under ₹50,000", orderBy: "order_date_time ASC" },
  { id: "2", view: "inv_2", title: "#2", desc: "CHQ ticket · no frontend user · first connect after order approval · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "3", view: "inv_3", title: "#3", desc: "Order amount above the team-wise limit (flagged Investigate) · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "6", view: "inv_6", title: "#6", desc: "CHQ ticket · invoice not Paid · order Cancelled / Closed · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "7", view: "inv_7", title: "#7", desc: "CHQ ticket · invoice not Paid · live order approved 60+ days ago · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "9", view: "inv_9", title: "#9", desc: "CHQ ticket · no frontend user · order phone differs from lead phone · since 1 Jan 2026", orderBy: "order_date_time ASC" },
  { id: "10", view: "inv_10", title: "#10", desc: "CHQ ticket ID present but no ticket-created time", orderBy: "order_date_time ASC" },
  { id: "11", view: "inv_11", title: "#11", desc: "Unassisted orders with a test / employee name (test, Test, Pawan, Ankit) · since 1 Jan 2026", orderBy: "purchase_date ASC" },
  { id: "14", view: "inv_14", title: "#14", desc: "Order's sales team differs from the team assigned by lead budget · since 1 May 2026", orderBy: "order_date_time DESC" },
  { id: "15", view: "inv_15", title: "#15", desc: "Invalid sales team flagged · since 1 May 2026", orderBy: "order_date_time DESC" },
  { id: "16", view: "inv_16", title: "#16", desc: "Lead created more than 90 days away from the order date · since 1 Jan 2026", orderBy: "order_date_time DESC" }
];

export function findInvestigation(id: string): Investigation | undefined {
  return INVESTIGATIONS.find((i) => i.id === id);
}
