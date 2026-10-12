-- Tùng — Sprint 2: đọc trước khi import Shop migration; không thay đổi DB.
-- Copy toàn bộ file vào Neon SQL Editor, chọn đúng branch/database và Run.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database_name, current_user AS sql_role,
       current_setting('server_version') AS postgres_version,
       now() AS checked_at;

-- Tùng — Sprint 2: kết quả issue_count phải bằng 0 cho mọi mục BLOCKER.
WITH existing_additions AS (
    SELECT 'table: ' || name AS item
    FROM (VALUES ('shop_schedule'), ('shop_submission')) names(name)
    WHERE to_regclass('public.' || name) IS NOT NULL
    UNION ALL
    SELECT 'column: ' || c.table_name || '.' || c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND (c.table_name, c.column_name) IN
          (('shop','row_version'), ('shop_dish','row_version'), ('notification','metadata'))
    UNION ALL
    SELECT 'function: ' || p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN
        ('bump_shop_row_version','guard_shop_dish_update','guard_shop_schedule_write',
         'check_shop_schedule_complete','valid_shop_form_snapshot','guard_shop_submission')
    UNION ALL
    SELECT 'index: ' || name
    FROM (VALUES ('uq_shop_dish_shop_dish'), ('uq_shop_submission_pending'),
                 ('idx_shop_submission_pending_queue'), ('idx_shop_submission_history')) names(name)
    WHERE to_regclass('public.' || name) IS NOT NULL
), invalid_schedule AS (
    SELECT shop_id FROM public.shop
    WHERE (open_days IN ('T2-CN','T2-T7')) IS NOT TRUE
       OR open_time IS NULL OR close_time IS NULL
       OR open_time >= TIME '24:00' OR close_time >= TIME '24:00'
       OR EXTRACT(SECOND FROM open_time) <> 0 OR EXTRACT(SECOND FROM close_time) <> 0
       OR close_time <= open_time
), invalid_price AS (
    SELECT shop_dish_id FROM public.shop_dish
    WHERE price IS NULL OR price = 'NaN'::numeric OR price < 0 OR price <> trunc(price)
), duplicate_menu AS (
    SELECT shop_id, dish_id FROM public.shop_dish
    GROUP BY shop_id, dish_id HAVING count(*) > 1
)
SELECT 'BLOCKER' AS severity, 'already_installed_or_partial_schema' AS check_name,
       count(*) AS issue_count FROM existing_additions
UNION ALL SELECT 'BLOCKER', 'unknown_or_invalid_legacy_schedule', count(*) FROM invalid_schedule
UNION ALL SELECT 'BLOCKER', 'invalid_menu_price', count(*) FROM invalid_price
UNION ALL SELECT 'BLOCKER', 'duplicate_shop_dish', count(*) FROM duplicate_menu
UNION ALL SELECT 'INFO', 'legacy_pending_requires_separate_recapture', count(*)
    FROM public.shop WHERE verification_status::text = 'pending';

-- Tùng — Sprint 2: nếu các SELECT sau có dòng, xử lý dữ liệu riêng trước migration.
SELECT shop_id::text, name, open_days, open_time, close_time
FROM public.shop
WHERE (open_days IN ('T2-CN','T2-T7')) IS NOT TRUE
   OR open_time IS NULL OR close_time IS NULL
   OR open_time >= TIME '24:00' OR close_time >= TIME '24:00'
   OR EXTRACT(SECOND FROM open_time) <> 0 OR EXTRACT(SECOND FROM close_time) <> 0
   OR close_time <= open_time
ORDER BY shop_id;

SELECT shop_dish_id::text, shop_id::text, dish_id::text, price::text
FROM public.shop_dish
WHERE price IS NULL OR price = 'NaN'::numeric OR price < 0 OR price <> trunc(price)
ORDER BY shop_dish_id;

SELECT shop_id::text, dish_id::text, count(*) AS duplicate_count
FROM public.shop_dish GROUP BY shop_id, dish_id HAVING count(*) > 1;

-- Tùng — Sprint 2: dự kiến 5 Shop, 20 links, 35 schedule rows theo lần đọc 07/10.
SELECT count(*) AS shops, count(*) * 7 AS expected_schedule_rows,
       (SELECT count(*) FROM public.shop_dish) AS menu_links
FROM public.shop;

SELECT s.shop_id::text, s.name, s.owner_account_id::text, r.name AS owner_role
FROM public.shop s
JOIN public.account a ON a.account_id = s.owner_account_id
JOIN public.role r ON r.role_id = a.role_id
WHERE s.verification_status::text = 'pending'
ORDER BY s.shop_id;

COMMIT;
