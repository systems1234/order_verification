import type { Investigation } from "./investigations";
import { caseKey } from "./investigations";
import type { Cell } from "./bqvalue";
import type { SchemaField } from "./bigquery";
import { reviewTable } from "./bigquery";

/** The four fields an auditor fills in. */
export interface ReviewFields {
  auditor: string;
  decision_types: string;
  decided_sales_person: string;
  comments: string;
}

/** Columns the review table owns; a view column with one of these names is not copied into it. */
const RESERVED = new Set([
  "case_key",
  "auditor",
  "decision_types",
  "decided_sales_person",
  "comments",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at"
]);

const DDL_TYPES: Record<string, string> = { INTEGER: "INT64", FLOAT: "FLOAT64", BOOLEAN: "BOOL" };

/** BigQuery metadata reports legacy type names (INTEGER, FLOAT, BOOLEAN); DDL / CAST want the standard ones. */
export function ddlType(t: string): string {
  const up = t.toUpperCase();
  if (up === "RECORD" || up === "STRUCT") throw new Error(`Unsupported column type ${t}`);
  return DDL_TYPES[up] ?? up;
}

/** Trim + length-check the four fields. Returns an error message, or the cleaned fields. */
export function validateFields(input: unknown): { error: string } | { fields: ReviewFields } {
  const o = (input ?? {}) as Record<string, unknown>;
  const get = (k: keyof ReviewFields) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
  const fields: ReviewFields = {
    auditor: get("auditor"),
    decision_types: get("decision_types"),
    decided_sales_person: get("decided_sales_person"),
    comments: get("comments")
  };
  if (!fields.auditor) return { error: "Auditor is required." };
  if (!fields.decision_types) return { error: "Decision type is required." };
  if (fields.auditor.length > 200 || fields.decision_types.length > 200 || fields.decided_sales_person.length > 200) {
    return { error: "Auditor, decision type and decided sales person must be 200 characters or fewer." };
  }
  if (fields.comments.length > 4000) return { error: "Comments must be 4000 characters or fewer." };
  return { fields };
}

/** Params are sent as STRING and cast in SQL: typed DATE params silently matched nothing earlier in this app. */
function param(v: Cell | undefined): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "boolean" ? (v ? "true" : "false") : String(v);
}

/** ALTER TABLE adding any view column the review table doesn't have yet; null when nothing is missing. */
export function buildAlterSql(inv: Investigation, viewFields: SchemaField[], tableFields: SchemaField[]): string | null {
  const have = new Set(tableFields.map((f) => f.name));
  const missing = viewFields.filter((f) => !RESERVED.has(f.name) && !have.has(f.name));
  if (missing.length === 0) return null;
  const adds = missing.map((f) => `ADD COLUMN IF NOT EXISTS \`${f.name}\` ${ddlType(f.type)}`).join(", ");
  return `ALTER TABLE ${reviewTable(inv.table)} ${adds}`;
}

/**
 * Insert-if-absent of one reviewed case. numDmlAffectedRows = 0 means the case was already reviewed.
 * Every view column present in the record is stored, so the table holds the complete record.
 */
export function buildInsert(
  inv: Investigation,
  viewFields: SchemaField[],
  record: Record<string, Cell>,
  fields: ReviewFields,
  userEmail: string
): { query: string; params: Record<string, string | null>; types: Record<string, string> } {
  const cols = viewFields.filter((f) => !RESERVED.has(f.name));
  const params: Record<string, string | null> = {
    case_key: caseKey(inv, record),
    auditor: fields.auditor,
    decision_types: fields.decision_types,
    decided_sales_person: fields.decided_sales_person,
    comments: fields.comments,
    user_email: userEmail
  };
  cols.forEach((f, i) => {
    params[`c${i}`] = param(record[f.name]);
  });
  const names = [
    "case_key",
    ...cols.map((f) => `\`${f.name}\``),
    "auditor",
    "decision_types",
    "decided_sales_person",
    "comments",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at"
  ].join(", ");
  const values = [
    "@case_key",
    ...cols.map((f, i) => `SAFE_CAST(@c${i} AS ${ddlType(f.type)})`),
    "@auditor",
    "@decision_types",
    "@decided_sales_person",
    "@comments",
    "@user_email",
    "CURRENT_TIMESTAMP()",
    "@user_email",
    "CURRENT_TIMESTAMP()"
  ].join(", ");
  const query = `
    MERGE ${reviewTable(inv.table)} t
    USING (SELECT @case_key AS case_key) s
    ON t.case_key = s.case_key
    WHEN NOT MATCHED THEN INSERT (${names}) VALUES (${values})`;
  const types = Object.fromEntries(Object.keys(params).map((k) => [k, "STRING"]));
  return { query, params, types };
}

export function buildUpdate(
  inv: Investigation,
  key: string,
  fields: ReviewFields,
  userEmail: string
): { query: string; params: Record<string, string>; types: Record<string, string> } {
  const params = { case_key: key, user_email: userEmail, ...fields };
  const query = `
    UPDATE ${reviewTable(inv.table)}
    SET auditor = @auditor, decision_types = @decision_types, decided_sales_person = @decided_sales_person,
        comments = @comments, updated_by = @user_email, updated_at = CURRENT_TIMESTAMP()
    WHERE case_key = @case_key`;
  const types = Object.fromEntries(Object.keys(params).map((k) => [k, "STRING"]));
  return { query, params, types };
}
