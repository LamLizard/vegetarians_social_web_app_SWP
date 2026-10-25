-- Tùng — Sprint 2: file tự kiểm tra READ ONLY cho người chạy, chỉ dùng SAU migration.
-- Agent chưa chạy file này. Đây là kiểm tra storage, không kiểm thử API/UI hoặc concurrency.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database_name, now() AS checked_at;

-- Tùng — Sprint 2: mọi dòng phải có installed = true.
WITH required(table_name, column_name, data_type, is_nullable) AS (VALUES
    ('shop','row_version','bigint','NO'),
    ('shop_dish','row_version','bigint','NO'),
    ('shop_dish','price','numeric','NO'),
    ('notification','metadata','jsonb','YES'),
    ('shop_schedule','shop_id','bigint','NO'),
    ('shop_schedule','day_of_week','smallint','NO'),
    ('shop_schedule','is_closed','boolean','NO'),
    ('shop_schedule','open_time','time without time zone','YES'),
    ('shop_schedule','close_time','time without time zone','YES'),
    ('shop_submission','shop_submission_id','bigint','NO'),
    ('shop_submission','shop_id','bigint','NO'),
    ('shop_submission','submission_type','text','NO'),
    ('shop_submission','before_value','jsonb','YES'),
    ('shop_submission','after_value','jsonb','NO'),
    ('shop_submission','status','text','NO'),
    ('shop_submission','submitted_by','bigint','NO'),
    ('shop_submission','submitted_at','timestamp with time zone','NO'),
    ('shop_submission','reviewed_by','bigint','YES'),
    ('shop_submission','reviewed_at','timestamp with time zone','YES'),
    ('shop_submission','review_note','character varying','YES')
)
SELECT r.table_name || '.' || r.column_name AS requirement,
       COALESCE(c.data_type = r.data_type AND c.is_nullable = r.is_nullable, false) AS installed,
       c.column_default, c.is_identity
FROM required r LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = r.table_name AND c.column_name = r.column_name
ORDER BY r.table_name, r.column_name;

WITH required(label) AS (VALUES
    ('shop_identity_edit_pending'),('shop_identity_edit_accepted'),('shop_identity_edit_rejected')
)
SELECT label, EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'notification_type_enum' AND e.enumlabel = label
) AS installed FROM required;

WITH required(table_name,index_name,must_be_unique) AS (VALUES
    ('shop_dish','uq_shop_dish_shop_dish',true),
    ('shop_submission','uq_shop_submission_pending',true),
    ('shop_submission','idx_shop_submission_pending_queue',false),
    ('shop_submission','idx_shop_submission_history',false)
)
SELECT r.index_name, COALESCE(i.indisvalid AND i.indisready
       AND (NOT r.must_be_unique OR i.indisunique)
       AND i.indrelid = to_regclass('public.' || r.table_name), false) AS installed,
       pg_get_indexdef(i.indexrelid) AS definition
FROM required r LEFT JOIN pg_index i ON i.indexrelid = to_regclass('public.' || r.index_name);

WITH required(table_name,trigger_name,must_be_deferred) AS (VALUES
    ('shop','trg_shop_row_version',false),
    ('shop_dish','trg_shop_dish_guard_update',false),
    ('shop_schedule','trg_shop_schedule_guard_write',false),
    ('shop_schedule','trg_shop_schedule_complete',true),
    ('shop','trg_shop_initial_schedule',true),
    ('shop_submission','trg_shop_submission_guard',false)
)
SELECT r.trigger_name, COALESCE(t.tgenabled IN ('O','A')
       AND (NOT r.must_be_deferred OR (t.tgdeferrable AND t.tginitdeferred)), false) AS installed,
       pg_get_triggerdef(t.oid) AS definition
FROM required r LEFT JOIN pg_trigger t
    ON t.tgrelid = to_regclass('public.' || r.table_name) AND t.tgname = r.trigger_name;

WITH required(table_name,constraint_name) AS (VALUES
    ('shop','ck_shop_row_version'),('shop_dish','ck_shop_dish_row_version'),
    ('shop_dish','ck_shop_dish_price_integer_vnd'),('shop_dish','uq_shop_dish_shop_dish'),
    ('notification','ck_notification_metadata_object'),('shop_schedule','ck_shop_schedule_hours'),
    ('shop_submission','ck_shop_submission_snapshot_objects'),('shop_submission','ck_shop_submission_outcome')
)
SELECT r.constraint_name, COALESCE(c.convalidated, false) AS installed,
       pg_get_constraintdef(c.oid) AS definition
FROM required r LEFT JOIN pg_constraint c
    ON c.conrelid = to_regclass('public.' || r.table_name) AND c.conname = r.constraint_name;

-- Tùng — Sprint 2: count chỉ đối chiếu snapshot, không hardcode 5/20 nếu dữ liệu đã phát sinh.
SELECT (SELECT count(*) FROM public.shop) AS shops,
       (SELECT count(*) FROM public.shop_dish) AS menu_links,
       (SELECT count(*) FROM public.shop_schedule) AS schedule_rows,
       (SELECT count(*) FROM public.shop) * 7 AS expected_schedule_rows,
       (SELECT count(*) FROM public.shop_submission) AS submissions;

WITH incomplete_schedule AS (
    SELECT s.shop_id FROM public.shop s LEFT JOIN public.shop_schedule sc ON sc.shop_id = s.shop_id
    GROUP BY s.shop_id HAVING count(sc.day_of_week) <> 7
        OR count(sc.day_of_week) FILTER (WHERE NOT sc.is_closed) = 0
), duplicate_menu AS (
    SELECT shop_id,dish_id FROM public.shop_dish GROUP BY shop_id,dish_id HAVING count(*) > 1
), duplicate_pending AS (
    SELECT shop_id FROM public.shop_submission WHERE status = 'pending'
    GROUP BY shop_id HAVING count(*) > 1
)
SELECT 'incomplete_schedule' AS check_name, count(*) AS issue_count FROM incomplete_schedule
UNION ALL SELECT 'invalid_menu_price', count(*) FROM public.shop_dish
    WHERE price IS NULL OR price = 'NaN'::numeric OR price < 0 OR price <> trunc(price)
UNION ALL SELECT 'duplicate_menu', count(*) FROM duplicate_menu
UNION ALL SELECT 'duplicate_pending', count(*) FROM duplicate_pending
UNION ALL SELECT 'invalid_shop_version', count(*) FROM public.shop WHERE row_version IS NULL OR row_version <= 0
UNION ALL SELECT 'invalid_menu_version', count(*) FROM public.shop_dish WHERE row_version IS NULL OR row_version <= 0
UNION ALL SELECT 'invalid_notification_metadata', count(*) FROM public.notification
    WHERE metadata IS NOT NULL AND jsonb_typeof(metadata) <> 'object';

-- Tùng — Sprint 2: danh sách pending chưa có hồ sơ. Một dòng Shop 4 nếu chưa recapture.
SELECT s.shop_id::text, s.name, s.verification_status,
       'requires_current_snapshot_recapture' AS action
FROM public.shop s
WHERE s.verification_status::text = 'pending'
  AND NOT EXISTS (SELECT 1 FROM public.shop_submission ss WHERE ss.shop_id = s.shop_id AND ss.status = 'pending')
ORDER BY s.shop_id;

SELECT shop_id::text, day_of_week, is_closed, open_time, close_time
FROM public.shop_schedule ORDER BY shop_id, day_of_week;

SELECT shop_submission_id::text, shop_id::text, submission_type, status,
       submitted_by::text, submitted_at, reviewed_by::text, reviewed_at, review_note
FROM public.shop_submission ORDER BY shop_submission_id;

COMMIT;
