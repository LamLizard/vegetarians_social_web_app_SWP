-- Tùng — BRIDGE-07: chỉ đọc, chạy NGAY SAU reset/migration, trước đăng ký mới.
-- Mọi passed phải true. Đây là kiểm chứng DB, không chứng minh BE/FE/Cloudinary.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog, public, pg_temp;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database_name,current_user AS sql_role,now() AS checked_at;

WITH checks(check_name,passed) AS (
    SELECT 'mandatory_shop_avatar',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='shop' AND column_name='avt_shop_url' AND data_type='text' AND is_nullable='NO' AND column_default IS NULL)
    UNION ALL SELECT 'mandatory_positive_slot_number',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='shop_schedule' AND column_name='slot_no' AND data_type='smallint' AND is_nullable='NO' AND column_default IS NULL)
    UNION ALL SELECT 'schedule_primary_key_triple',EXISTS(SELECT 1 FROM pg_constraint c WHERE c.contype='p'
      AND c.conrelid='public.shop_schedule'::regclass AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,pos)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.pos)=ARRAY['shop_id','day_of_week','slot_no'])
    UNION ALL SELECT 'avatar_nonblank_check',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.shop'::regclass
      AND conname='ck_shop_avatar_url_not_blank' AND contype='c' AND convalidated)
    UNION ALL SELECT 'slot_positive_check',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.shop_schedule'::regclass
      AND conname='ck_shop_schedule_slot_no' AND contype='c' AND convalidated)
    UNION ALL SELECT 'weekday_range_check_preserved',EXISTS(SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.shop_schedule'::regclass AND c.conname='shop_schedule_day_of_week_check'
        AND c.contype='c' AND c.convalidated AND pg_get_expr(c.conbin,c.conrelid)='((day_of_week >= 1) AND (day_of_week <= 7))')
    UNION ALL SELECT 'closed_slot_one_and_hours_check',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.shop_schedule'::regclass
      AND conname='ck_shop_schedule_hours' AND convalidated AND pg_get_constraintdef(oid) LIKE '%slot_no = 1%')
    UNION ALL SELECT 'schedule_key_guard_updated',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_shop_schedule_write()')
      AND prosrc LIKE '%NEW.slot_no%' AND prorettype='trigger'::regtype)
    UNION ALL SELECT 'schedule_day_and_overlap_guard_updated',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.check_shop_schedule_complete()')
      AND prosrc LIKE '%count(DISTINCT day_of_week)%' AND prosrc LIKE '%x.open_time<y.close_time%' AND prosrc LIKE '%bool_or(is_closed)%')
    UNION ALL SELECT 'new_schedule_snapshot_validator',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.valid_shop_schedule_snapshot(jsonb)')
      AND prorettype='boolean'::regtype AND obj_description(oid,'pg_proc') LIKE 'shop_avatar_schedule_v1:%')
    UNION ALL SELECT 'form_snapshot_avatar_and_slots',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.valid_shop_form_snapshot(jsonb)')
      AND prosrc LIKE '%avtShopUrl%' AND prosrc LIKE '%valid_shop_schedule_snapshot%')
    UNION ALL SELECT 'identity_avatar_guard_updated',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_shop_submission()')
      AND prosrc LIKE '%task_key=''avtShopUrl''%' AND prosrc LIKE '%Submission history cannot be deleted%')
    UNION ALL SELECT 'pending_submission_unique_preserved',EXISTS(SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public.uq_shop_submission_pending')
      AND i.indrelid='public.shop_submission'::regclass AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1
      AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(n,pos)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n WHERE k.pos<=i.indnkeyatts ORDER BY k.pos)=ARRAY['shop_id']
      AND pg_get_expr(i.indpred,i.indrelid)='(status = ''pending''::text)')
    UNION ALL SELECT 'empty_shop_baseline',NOT EXISTS(SELECT 1 FROM public.shop)
    UNION ALL SELECT 'empty_menu_baseline',NOT EXISTS(SELECT 1 FROM public.shop_dish)
    UNION ALL SELECT 'empty_schedule_baseline',NOT EXISTS(SELECT 1 FROM public.shop_schedule)
    UNION ALL SELECT 'empty_submission_baseline',NOT EXISTS(SELECT 1 FROM public.shop_submission)
    UNION ALL SELECT 'no_shop_notification_refs',NOT EXISTS(SELECT 1 FROM public.notification WHERE ref_type::text='shop' OR type::text IN
      ('shop_pending_verification','shop_verified','shop_rejected','shop_identity_edit_pending','shop_identity_edit_accepted','shop_identity_edit_rejected'))
    UNION ALL SELECT 'no_shop_admin_logs',NOT EXISTS(SELECT 1 FROM public.admin_log WHERE target_type::text IN ('shop','shop_dish'))
)
SELECT check_name,passed FROM checks ORDER BY check_name;

WITH required(table_name,name,function_name,trigger_type,deferred) AS (VALUES
    ('shop','trg_shop_row_version','bump_shop_row_version',19,false),
    ('shop_dish','trg_shop_dish_guard_update','guard_shop_dish_update',19,false),
    ('shop_schedule','trg_shop_schedule_guard_write','guard_shop_schedule_write',31,false),
    ('shop_schedule','trg_shop_schedule_complete','check_shop_schedule_complete',29,true),
    ('shop','trg_shop_initial_schedule','check_shop_schedule_complete',5,true),
    ('shop_submission','trg_shop_submission_guard','guard_shop_submission',31,false))
SELECT r.name AS check_name,coalesce(t.tgenabled IN ('O','A') AND t.tgtype=r.trigger_type
    AND t.tgfoid=to_regprocedure('public.'||r.function_name||'()')
    AND (NOT r.deferred OR (t.tgdeferrable AND t.tginitdeferred)),false) AS passed
FROM required r LEFT JOIN pg_trigger t ON t.tgrelid=to_regclass('public.'||r.table_name) AND t.tgname=r.name;

-- Tùng — kiểm chứng validators bằng JSON tạm trong SELECT; không INSERT test data.
WITH samples AS (SELECT jsonb_agg(jsonb_build_object('dayOfWeek',d,'isClosed',d<>1,'slots',
    CASE WHEN d=1 THEN '[{"openTime":"08:00","closeTime":"12:00"},{"openTime":"13:00","closeTime":"21:00"}]'::jsonb ELSE '[]'::jsonb END) ORDER BY d) AS schedule
    FROM generate_series(1,7) d)
SELECT 'snapshot_split_shift' AS check_name,public.valid_shop_schedule_snapshot(schedule) AS passed FROM samples
UNION ALL SELECT 'snapshot_adjacent_shift',public.valid_shop_schedule_snapshot(jsonb_set(schedule,'{0,slots,1,openTime}','"12:00"')) FROM samples
UNION ALL SELECT 'snapshot_overlap_rejected',NOT public.valid_shop_schedule_snapshot(jsonb_set(schedule,'{0,slots,1,openTime}','"11:00"')) FROM samples
UNION ALL SELECT 'snapshot_closed_slots_rejected',NOT public.valid_shop_schedule_snapshot(jsonb_set(schedule,'{1,slots}','[{"openTime":"08:00","closeTime":"12:00"}]')) FROM samples
UNION ALL SELECT 'form_avatar_longer_than_phone_limit',public.valid_shop_form_snapshot(jsonb_build_object(
    'name','Sample','address','Sample address','phone','0901234567','avtShopUrl','https://res.cloudinary.com/sample/image/upload/v1/shop/photo.webp','schedule',schedule)) FROM samples
UNION ALL SELECT 'form_blank_avatar_rejected',NOT public.valid_shop_form_snapshot(jsonb_build_object(
    'name','Sample','address','Sample address','phone','0901234567','avtShopUrl','   ','schedule',schedule)) FROM samples;

SELECT (SELECT count(*) FROM public.shop) AS shops,(SELECT count(*) FROM public.shop_dish) AS menu_rows,
    (SELECT count(*) FROM public.shop_schedule) AS schedule_rows,(SELECT count(*) FROM public.shop_submission) AS submissions;
SELECT 'shop_avatar_schedule_v1' AS expected_revision,
    'Preservation/content/sequence checks ran inside the migration transaction. Compare its passed result and removed_rows with preflight.' AS preservation_evidence;
COMMIT;
