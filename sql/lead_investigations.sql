-- Lead investigations: review tables + views (location asia-south2).
-- Each view wraps the ORIGINAL query unchanged (edit the part inside the parentheses) and hides
-- any case already reviewed in the app, which lives in <view>_reviews.
-- Case key: lead_investigation_1 = lead_id | closed date (a lead can re-close later);
--           lead_investigation_2 = lead_id.

CREATE TABLE IF NOT EXISTS `mis-gempundit.order_verification.lead_investigation_1_reviews` (
  case_key STRING, lead_id STRING, closed_state STRING, closed_at TIMESTAMP, next_state STRING,
  next_state_updatedAt TIMESTAMP, day_gap INT64, assignedTo STRING,
  auditor STRING, decision_types STRING, decided_sales_person STRING, comments STRING,
  created_by STRING, created_at TIMESTAMP, updated_by STRING, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `mis-gempundit.order_verification.lead_investigation_2_reviews` (
  case_key STRING, lead_id STRING, final_order_value FLOAT64, expected_category STRING, agent_count INT64,
  first_assignee STRING, first_assignee_category STRING, other_assignees STRING, Assignment_Flag STRING,
  auditor STRING, decision_types STRING, decided_sales_person STRING, comments STRING,
  created_by STRING, created_at TIMESTAMP, updated_by STRING, updated_at TIMESTAMP
);

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.lead_investigation_1` AS
SELECT * FROM (
WITH Ordered AS (
  SELECT
    lead_id,
    state,
    updatedAt,
    assignedTo,
    LAG(state) OVER (PARTITION BY lead_id ORDER BY updatedAt) AS prev_state,

    -- closed ke baad pehli baar jab state != closed hui, uska timestamp
    FIRST_VALUE(IF(LOWER(state) != 'closed', updatedAt, NULL) IGNORE NULLS)
      OVER (PARTITION BY lead_id ORDER BY updatedAt
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) AS next_state_updatedAt,

    -- aur wo new state kya thi
    FIRST_VALUE(IF(LOWER(state) != 'closed', state, NULL) IGNORE NULLS)
      OVER (PARTITION BY lead_id ORDER BY updatedAt
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) AS next_state
  FROM `mis-gempundit.Chakrahq.Customer_Data`
)

SELECT
  lead_id,
  state AS closed_state,
  updatedAt AS closed_at,
  next_state,
  next_state_updatedAt,
  DATE_DIFF(DATE(next_state_updatedAt), DATE(updatedAt), DAY) AS day_gap,
  assignedTo
FROM Ordered
WHERE LOWER(state) = 'closed'
  AND (prev_state IS NULL OR LOWER(prev_state) != 'closed')  -- sirf closed hone wali entry row
  AND next_state_updatedAt IS NOT NULL                        -- state actually change hui
  AND DATE_DIFF(DATE(next_state_updatedAt), DATE(updatedAt), DAY) > 60
ORDER BY next_state_updatedAt DESC
) AS o
WHERE NOT EXISTS (
  SELECT 1 FROM `mis-gempundit.order_verification.lead_investigation_1_reviews` r
  WHERE r.case_key = CONCAT(IFNULL(o.lead_id,''),'|',IFNULL(CAST(DATE(o.closed_at) AS STRING),''))
)
ORDER BY next_state_updatedAt DESC;

CREATE OR REPLACE VIEW `mis-gempundit.order_verification.lead_investigation_2` AS
SELECT * FROM (
WITH AssignHist AS (
  SELECT lead_id, assignedTo, category, updatedAt
  FROM `mis-gempundit.Chakrahq.Customer_Data`
  WHERE assignedTo IS NOT NULL AND TRIM(assignedTo) != ''
),

-- har lead ke har agent ki pehli assignment aur us waqt ki category
FirstPerAgent AS (
  SELECT
    lead_id,
    assignedTo,
    MIN(updatedAt) AS first_assigned_at,
    ARRAY_AGG(category ORDER BY updatedAt LIMIT 1)[SAFE_OFFSET(0)] AS agent_category
  FROM AssignHist
  GROUP BY lead_id, assignedTo
),

Ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY first_assigned_at, assignedTo) AS assign_rank,
    COUNT(*) OVER (PARTITION BY lead_id) AS agent_count
  FROM FirstPerAgent
),

-- latest non-null order value per lead
LeadValue AS (
  SELECT
    lead_id,
    ARRAY_AGG(final_order_value IGNORE NULLS ORDER BY updatedAt DESC LIMIT 1)[SAFE_OFFSET(0)] AS final_order_value
  FROM `mis-gempundit.Chakrahq.Customer_Data`
  GROUP BY lead_id
),

-- budget se expected category (min inclusive, max exclusive)
Expected AS (
  SELECT
    v.lead_id,
    v.final_order_value,
    b.category AS expected_category
  FROM LeadValue v
  LEFT JOIN `mis-gempundit.order_verification.team_budget_all` b
    ON v.final_order_value >= b.min_value
   AND (b.max_value IS NULL OR v.final_order_value < b.max_value)
)

SELECT
  r.lead_id,
  e.final_order_value,
  e.expected_category,
  r.agent_count,
  MAX(IF(r.assign_rank = 1, r.assignedTo, NULL))      AS first_assignee,
  MAX(IF(r.assign_rank = 1, r.agent_category, NULL))  AS first_assignee_category,
  STRING_AGG(
    IF(r.assign_rank > 1, CONCAT(r.assignedTo, ' (', IFNULL(r.agent_category, 'NA'), ')'), NULL),
    ', ' ORDER BY r.first_assigned_at
  ) AS other_assignees,
  'First Right, Others Wrong' AS Assignment_Flag
FROM Ranked r
JOIN Expected e USING (lead_id)
WHERE e.expected_category IS NOT NULL
GROUP BY r.lead_id, e.final_order_value, e.expected_category, r.agent_count
HAVING r.agent_count > 1
   AND UPPER(TRIM(MAX(IF(r.assign_rank = 1, r.agent_category, NULL)))) = UPPER(TRIM(e.expected_category))
   AND COUNTIF(r.assign_rank > 1
               AND UPPER(TRIM(IFNULL(r.agent_category, ''))) = UPPER(TRIM(e.expected_category))) = 0
ORDER BY r.lead_id
) AS o
WHERE NOT EXISTS (
  SELECT 1 FROM `mis-gempundit.order_verification.lead_investigation_2_reviews` r
  WHERE r.case_key = IFNULL(o.lead_id,'')
)
ORDER BY lead_id ASC;
