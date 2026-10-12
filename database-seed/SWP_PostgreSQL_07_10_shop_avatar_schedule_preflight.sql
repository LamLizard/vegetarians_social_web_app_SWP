-- Tùng — BRIDGE-07: chỉ đọc, chạy trước bộ reset/avatar/lịch nhiều ca.
-- Mọi BLOCKER phải có issue_count=0. Không chạy lại migration nếu đã có cột mới.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, pg_temp;

SELECT current_database() AS database_name, current_user AS sql_role,
       current_setting('server_version') AS postgres_version, now() AS checked_at;

-- BEGIN SHOP DELTA BASELINE CHECKS
WITH targets(name) AS (VALUES ('shop'),('shop_dish'),('shop_schedule'),('shop_submission'),('notification'),('admin_log')),
required_columns(table_name,column_name,data_type,must_be_not_null) AS (VALUES
    ('shop','shop_id','bigint',true),('shop','owner_account_id','bigint',true),('shop','row_version','bigint',true),
    ('shop_schedule','shop_id','bigint',true),('shop_schedule','day_of_week','smallint',true),
    ('shop_schedule','is_closed','boolean',true),('shop_schedule','open_time','time without time zone',false),
    ('shop_schedule','close_time','time without time zone',false),('shop_dish','shop_dish_id','bigint',true),
    ('shop_dish','shop_id','bigint',true),('shop_dish','row_version','bigint',true),
    ('shop_submission','shop_submission_id','bigint',true),('shop_submission','shop_id','bigint',true),
    ('shop_submission','before_value','jsonb',false),('shop_submission','after_value','jsonb',true),
    ('shop_submission','submitted_by','bigint',true),('shop_submission','status','text',true),
    ('notification','type','USER-DEFINED',true),('notification','ref_type','USER-DEFINED',false),
    ('notification','ref_id','bigint',false),('notification','metadata','jsonb',false),
    ('admin_log','target_type','USER-DEFINED',true),('admin_log','target_id','bigint',false)),
required_triggers(table_name,name,function_name,trigger_type,deferred) AS (VALUES
    ('shop','trg_shop_row_version','bump_shop_row_version',19,false),
    ('shop_dish','trg_shop_dish_guard_update','guard_shop_dish_update',19,false),
    ('shop_schedule','trg_shop_schedule_guard_write','guard_shop_schedule_write',31,false),
    ('shop_schedule','trg_shop_schedule_complete','check_shop_schedule_complete',29,true),
    ('shop','trg_shop_initial_schedule','check_shop_schedule_complete',5,true),
    ('shop_submission','trg_shop_submission_guard','guard_shop_submission',31,false)),
required_checks(table_name,name) AS (VALUES
    ('shop','ck_shop_row_version'),('shop_dish','ck_shop_dish_row_version'),
    ('shop_dish','ck_shop_dish_price_integer_vnd'),('shop_dish','uq_shop_dish_shop_dish'),
    ('notification','ck_notification_metadata_object'),('shop_schedule','ck_shop_schedule_hours'),
    ('shop_submission','ck_shop_submission_snapshot_objects'),('shop_submission','ck_shop_submission_outcome')),
checks(check_name,issue_count) AS (
    SELECT 'missing_or_nonplain_tables',count(*) FROM targets x LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||x.name)
      WHERE c.oid IS NULL OR c.relkind<>'r' OR c.relispartition
    UNION ALL SELECT 'RLS_on_mutation_targets',count(*) FROM targets x JOIN pg_class c ON c.oid=to_regclass('public.'||x.name)
      WHERE c.relrowsecurity OR c.relforcerowsecurity
    UNION ALL SELECT 'inheritance_on_mutation_targets',count(*) FROM pg_inherits i
      WHERE i.inhrelid IN (SELECT to_regclass('public.'||name) FROM targets)
         OR i.inhparent IN (SELECT to_regclass('public.'||name) FROM targets)
    UNION ALL SELECT 'missing_or_incompatible_columns',count(*) FROM required_columns r LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
      WHERE c.column_name IS NULL OR c.data_type<>r.data_type OR (r.must_be_not_null AND c.is_nullable<>'NO')
    UNION ALL SELECT 'already_installed_or_partial_delta',count(*) FROM information_schema.columns c WHERE c.table_schema='public'
      AND (c.table_name,c.column_name) IN (('shop','avt_shop_url'),('shop_schedule','slot_no'))
    UNION ALL SELECT 'delta_function_name_collision',CASE WHEN to_regprocedure('public.valid_shop_schedule_snapshot(jsonb)') IS NULL THEN 0 ELSE 1 END
    UNION ALL SELECT 'unexpected_foreign_key_dependency',count(*) FROM pg_constraint c WHERE c.contype='f'
      AND c.confrelid IN (SELECT to_regclass('public.'||name) FROM targets)
      AND NOT (c.confrelid=to_regclass('public.shop') AND c.conrelid IN
        (to_regclass('public.shop_dish'),to_regclass('public.shop_schedule'),to_regclass('public.shop_submission'))
        AND c.convalidated AND c.confdeltype IN ('a','r')
        AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,pos)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.pos)=ARRAY['shop_id']
        AND ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,pos)
          JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.pos)=ARRAY['shop_id'])
    UNION ALL SELECT 'missing_shop_foreign_keys',count(*) FROM (VALUES ('shop_dish'),('shop_schedule'),('shop_submission')) x(name)
      WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.convalidated
        AND c.conrelid=to_regclass('public.'||x.name) AND c.confrelid=to_regclass('public.shop')
        AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='shop_id')]::smallint[]
        AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='shop_id')]::smallint[])
    UNION ALL SELECT 'old_schedule_primary_key_mismatch',CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='p'
      AND c.conrelid=to_regclass('public.shop_schedule') AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,pos)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.pos)=ARRAY['shop_id','day_of_week']) THEN 0 ELSE 1 END
    UNION ALL SELECT 'missing_or_disabled_guard_triggers',count(*) FROM required_triggers r LEFT JOIN pg_trigger t
      ON t.tgrelid=to_regclass('public.'||r.table_name) AND t.tgname=r.name
      WHERE t.oid IS NULL OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>r.trigger_type
        OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.'||r.function_name||'()')
        OR (r.deferred AND NOT(t.tgdeferrable AND t.tginitdeferred))
    UNION ALL SELECT 'unexpected_trigger',count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE t.tgrelid IN (SELECT to_regclass('public.'||name) FROM targets) AND NOT t.tgisinternal
        AND NOT EXISTS (SELECT 1 FROM required_triggers r WHERE r.table_name=c.relname AND r.name=t.tgname)
        AND NOT ((c.relname,t.tgname) IN (('shop','trg_shop_set_updated_at'),('shop_dish','trg_shop_dish_set_updated_at')) AND t.tgtype=19)
    UNION ALL SELECT 'unexpected_rewrite_rule',count(*) FROM pg_rewrite r
      WHERE r.ev_class IN (SELECT to_regclass('public.'||name) FROM targets) AND r.rulename<>'_RETURN'
    UNION ALL SELECT 'missing_or_unvalidated_constraints',count(*) FROM required_checks r LEFT JOIN pg_constraint c
      ON c.conrelid=to_regclass('public.'||r.table_name) AND c.conname=r.name WHERE c.oid IS NULL OR NOT c.convalidated
    UNION ALL SELECT 'missing_old_snapshot_validator',CASE WHEN to_regprocedure('public.valid_shop_form_snapshot(jsonb)') IS NULL THEN 1 ELSE 0 END
    UNION ALL SELECT 'missing_weekday_range_constraint',CASE WHEN EXISTS(SELECT 1 FROM pg_constraint c
      WHERE c.conrelid=to_regclass('public.shop_schedule') AND c.conname='shop_schedule_day_of_week_check'
        AND c.contype='c' AND c.convalidated AND pg_get_expr(c.conbin,c.conrelid)='((day_of_week >= 1) AND (day_of_week <= 7))') THEN 0 ELSE 1 END
    UNION ALL SELECT 'missing_pending_unique_index',CASE WHEN EXISTS(SELECT 1 FROM pg_index i
      WHERE i.indexrelid=to_regclass('public.uq_shop_submission_pending') AND i.indrelid=to_regclass('public.shop_submission')
        AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1
        AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(n,pos)
          JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n WHERE k.pos<=i.indnkeyatts ORDER BY k.pos)=ARRAY['shop_id']
        AND pg_get_expr(i.indpred,i.indrelid)='(status = ''pending''::text)') THEN 0 ELSE 1 END
    UNION ALL SELECT 'missing_shop_notification_types',count(*) FROM (VALUES ('shop_pending_verification'),('shop_verified'),('shop_rejected'),
      ('shop_identity_edit_pending'),('shop_identity_edit_accepted'),('shop_identity_edit_rejected')) x(label)
      WHERE NOT EXISTS(SELECT 1 FROM pg_enum e WHERE e.enumtypid=to_regtype('public.notification_type_enum') AND e.enumlabel=x.label)
    UNION ALL SELECT 'delta_constraint_name_collision',count(*) FROM pg_constraint c
      WHERE (c.conrelid,c.conname) IN ((to_regclass('public.shop'),'ck_shop_avatar_url_not_blank'),(to_regclass('public.shop_schedule'),'ck_shop_schedule_slot_no'))
)
SELECT 'BLOCKER'::text AS severity,check_name,issue_count FROM checks ORDER BY check_name;
-- END SHOP DELTA BASELINE CHECKS

-- Tùng — counts để biết dữ liệu sẽ reset; không hardcode số Shop/demo.
SELECT (SELECT count(*) FROM public.shop) AS shops_to_reset,
       (SELECT count(*) FROM public.shop_dish) AS menu_rows_to_reset,
       (SELECT count(*) FROM public.shop_schedule) AS schedule_rows_to_reset,
       (SELECT count(*) FROM public.shop_submission) AS submissions_to_reset,
       (SELECT count(*) FROM public.notification WHERE ref_type::text='shop' OR type::text IN
          ('shop_pending_verification','shop_verified','shop_rejected','shop_identity_edit_pending','shop_identity_edit_accepted','shop_identity_edit_rejected')) AS notifications_to_clear,
       (SELECT count(*) FROM public.admin_log WHERE target_type::text IN ('shop','shop_dish')) AS admin_logs_to_clear;

SELECT c.conname,c.conrelid::regclass::text AS source_table,c.confrelid::regclass::text AS target_table,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c WHERE c.contype='f' AND c.confrelid IN
    ('public.shop'::regclass,'public.shop_dish'::regclass,'public.shop_schedule'::regclass,
     'public.shop_submission'::regclass,'public.notification'::regclass,'public.admin_log'::regclass)
ORDER BY source_table,c.conname;

SELECT 'shop_avatar_schedule_v1' AS proposed_revision,
       'Shop rows/Shop refs will be reset. Accounts/catalog/other features and sequence IDs are preserved.' AS scope;
COMMIT;
