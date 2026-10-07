-- Order investigation views (run AFTER investigation_reviews.sql).
-- They read assited_orders_for_verification_snapshot (refreshed weekly by a scheduled query, see
-- assisted_orders_snapshot.sql) instead of the heavy assited_orders_for_verification view, so they load fast.
-- Source: the Google Sheet QUERY() formulas, re-pointed at the view's column NAMES (the sheet's column order
-- differs from the view at positions 47-49). #4 is skipped (reads Lead_Details).
-- #1.2.1 / #1.3: the sheet conditions pointed at the wrong columns; this is a best-effort reading to verify.

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_1` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_id_text,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND username_frontend IS NULL
  AND order_type_in_mtd_form != 'COD-30'
  AND true_false_02_vs_ticket_created_date = TRUE
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_1_1_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_1_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_2` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_id_text,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  diff_min_ticket_created_vs_02_pending_approval
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND username_frontend IS NULL
  AND order_type_in_mtd_form != 'COD-30'
  AND diff_min_ticket_created_vs_02_pending_approval IS NOT NULL
  AND diff_min_ticket_created_vs_02_pending_approval < 30
  /* Cases already reviewed in the app (saved to inv_1_2_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_2_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_2_1` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  diff_min_ticket_created_vs_02_pending_approval
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND order_type_in_mtd_form != 'COD-30'
  AND first_connect_time_true_false = FALSE
  AND pending_approval_02_step_timestamp IS NOT NULL
  AND diff_min_ticket_created_vs_02_pending_approval IS NOT NULL
  AND diff_min_ticket_created_vs_02_pending_approval < 30
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_1_2_1_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_2_1_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_3` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  diff_min_ticket_created_vs_02_pending_approval
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND order_type_in_mtd_form != 'COD-30'
  AND first_connect_time_true_false = FALSE
  AND diff_min_ticket_created_vs_02_pending_approval > 30
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_1_3_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_3_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_4` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  diff_min_ticket_created_vs_02_pending_approval
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND username_frontend IS NULL
  AND order_type_in_mtd_form = 'COD-30'
  AND total_amount < 100000
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_1_4_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_4_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_1_41` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_id_text,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  diff_min_ticket_created_vs_02_pending_approval
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE payment_method = 'cashondelivery'
  AND username_frontend IS NULL
  AND total_amount < 50000
  /* Cases already reviewed in the app (saved to inv_1_41_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_1_41_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_2` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  diff_min_1st_connect_vs_10_order_approved
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE STRPOS(ticket_id_text, 'CHQ-') > 0
  AND username_frontend IS NULL
  AND first_connect_time_true_false = TRUE
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_2_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_2_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE order_limit_team_wise_investigate = 'Investigate'
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_3_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_3_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_6` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE invoice_status <> 'Paid'
  AND STRPOS(tickets_id, 'CHQ-') > 0
  AND current_order_status IN (
    'Canceled - Follow Up not Required',
    'Canceled - Support to Review',
    'Canceled (Pending)',
    'Canceled - Sales to Review - Initiated',
    'Canceled - Support to Handle - Initiated',
    'Canceled - Sales to Review',
    'Canceled',
    'Closed'
  )
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_6_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_6_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_7` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  current_order_status
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE invoice_status <> 'Paid'
  AND STRPOS(tickets_id, 'CHQ-') > 0
  AND current_order_status NOT IN (
    'Canceled - Follow Up not Required',
    'Canceled - Support to Review',
    'Canceled (Pending)',
    'Canceled - Sales to Review - Initiated',
    'Canceled - Support to Handle - Initiated',
    'Canceled - Sales to Review',
    'Canceled',
    '94.1 - RTO Received - Order To Be Cancelled',
    '96 - Replaced with New Accurate Order',
    '9900 - Create Credit Memo (Processing) [Processing]',
    '9901 - Processing Refund [Processing]',
    '9909 - Fully Refunded',
    '9920 - Cancelled - Full Amount Forfeit',
    '9921 - Cancelled - Partial Amount Forfeit',
    '9930 - Shipment lost by Logistic Partner',
    '961 - Cancelled Before Shipment (but invoice had been created)'
  )
  /* The sheet compared the approval time to a date, i.e. to that day midnight. */
  AND approval_timestamp <= DATETIME(DATE_SUB(CURRENT_DATE('Asia/Kolkata'), INTERVAL 60 DAY))
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_7_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_7_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_9` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  customer_name,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  order_phone_number_1,
  lead_phone_number
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE STRPOS(tickets_id, 'CHQ-') > 0
  AND username_frontend IS NULL
  AND order_phone_ne_lead_phone = FALSE
  AND order_date_time >= TIMESTAMP '2026-01-01 00:00:00'
  /* Cases already reviewed in the app (saved to inv_9_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_9_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_10` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  first_connect_time_true_false,
  lead_sources
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE ticket_created_at IS NULL
  AND tickets_id IS NOT NULL
  AND STRPOS(tickets_id, 'CHQ-') > 0
  /* Cases already reviewed in the app (saved to inv_10_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_10_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_11` AS
SELECT
  purchase_date,
  oldest_order_number,
  customer_name,
  amount,
  newest_order_number
FROM `mis-gempundit.order_verification.unassited_orders` AS o
WHERE REGEXP_CONTAINS(customer_name, r'test|Test|Pawan|Ankit')
  AND purchase_date >= DATE '2026-01-01'
  /* Cases already reviewed in the app (saved to inv_11_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_11_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_number,''))
  )
ORDER BY purchase_date ASC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_14` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  current_order_status,
  lead_created_at,
  final_assigned_to_name,
  helper_budget,
  assigned_team_acc_to_budget
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE team <> assigned_to_team
  AND name_as_per_lead_budget IS NOT NULL
  AND order_date_time >= TIMESTAMP '2026-05-01 00:00:00'
  AND tickets_id IS NOT NULL
  AND STRPOS(tickets_id, 'CHQ-') > 0
  /* Cases already reviewed in the app (saved to inv_14_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_14_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time DESC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_15` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  current_order_status,
  lead_created_at,
  final_assigned_to_name,
  helper_budget,
  assigned_team_acc_to_budget
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE invalid_sales_team_flag IS NOT NULL
  AND helper_budget IS NOT NULL
  AND order_date_time >= TIMESTAMP '2026-05-01 00:00:00'
  AND tickets_id IS NOT NULL
  AND STRPOS(tickets_id, 'CHQ-') > 0
  /* Cases already reviewed in the app (saved to inv_15_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_15_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time DESC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.inv_16` AS
SELECT
  approval_timestamp,
  sales_person,
  oldest_order_number,
  order_date_time,
  total_amount,
  newest_order_no,
  tickets_id,
  ticket_created_at,
  first_connected_time,
  mtd_form_filled_timestamp,
  username_frontend,
  lead_sources,
  payment_method,
  order_type_in_mtd_form,
  pending_approval_02_step_timestamp,
  current_order_status,
  lead_created_at,
  final_assigned_to_name
FROM `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS o
WHERE ticket_id_beyond_90_days IS NOT NULL
  AND `date` >= DATE '2026-01-01'
  AND tickets_id IS NOT NULL
  AND STRPOS(tickets_id, 'CHQ-') > 0
  /* Cases already reviewed in the app (saved to inv_16_reviews) drop out of this view. Keep this clause when editing. */
  AND NOT EXISTS (
    SELECT 1 FROM `mis-gempundit.order_verification.inv_16_reviews` r
    WHERE r.case_key = CONCAT(IFNULL(o.oldest_order_number,''),'|',IFNULL(o.newest_order_no,''),'|',IFNULL(o.sales_person,''))
  )
ORDER BY order_date_time DESC;
