-- Weekly snapshot of the heavy view, so the app and the investigation views load fast.
--
-- Table:  mis-gempundit.order_verification.assited_orders_for_verification_snapshot
-- Source: mis-gempundit.order_verification.assited_orders_for_verification
--
-- SCHEDULED QUERY (BigQuery console > Scheduled queries > Create):
--   Query:           the statement below, exactly as is
--   Destination:     leave EMPTY (the statement writes the table itself)
--   Repeats:         Weekly (e.g. every Monday ~06:00 IST = custom schedule "every mon 00:30" in UTC)
--   Location:        asia-south2
-- The statement is atomic: readers keep seeing the old data until the new table is ready, and a column
-- added to the view later is picked up automatically. You can also run it by hand any time to refresh.

CREATE OR REPLACE TABLE `mis-gempundit.order_verification.assited_orders_for_verification_snapshot` AS
SELECT * FROM `mis-gempundit.order_verification.assited_orders_for_verification`;
