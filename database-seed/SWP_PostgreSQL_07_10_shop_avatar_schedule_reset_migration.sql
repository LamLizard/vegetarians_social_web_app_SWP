-- Tùng — BRIDGE-07: RESET Shop/refs + avatar bắt buộc + lịch nhiều ca, chạy MỘT LẦN.
-- Tùng tự chạy toàn bộ file trên đúng Neon branch/database sau preflight.
-- Giữ Account/catalog/feature khác, sequence IDs và file SQL lịch sử.
-- Lỗi bất kỳ bước nào => ROLLBACK. Không chạy seed/recapture cũ sau file này.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path = pg_catalog, public, pg_temp;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

LOCK TABLE public.shop, public.shop_dish, public.shop_schedule, public.shop_submission,
    public.notification, public.admin_log IN ACCESS EXCLUSIVE MODE;

DO $shop_delta_preconditions$
DECLARE task_issues TEXT;
BEGIN
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
SELECT string_agg(check_name||'='||issue_count, ', ' ORDER BY check_name) INTO task_issues FROM checks WHERE issue_count>0;
    IF task_issues IS NOT NULL THEN
        RAISE EXCEPTION 'Shop delta preconditions failed (already installed/partial delta, dependency or schema mismatch): %', task_issues
            USING HINT='Stop. Do not drop dependencies or rerun reset. Run the read-only preflight/verify and review the mismatch.';
    END IF;
END;
$shop_delta_preconditions$;

-- Tùng — capture IDs/counts, không xuất dữ liệu cá nhân hoặc credentials.
CREATE TEMP TABLE shop_delta_reset_ids ON COMMIT DROP AS
    SELECT 'shop'::text AS kind,shop_id AS id FROM public.shop
    UNION ALL SELECT 'menu',shop_dish_id FROM public.shop_dish
    UNION ALL SELECT 'submission',shop_submission_id FROM public.shop_submission;
CREATE TEMP TABLE shop_delta_stats(kind TEXT PRIMARY KEY,amount BIGINT NOT NULL) ON COMMIT DROP;
INSERT INTO shop_delta_stats SELECT 'shop',count(*) FROM public.shop;
INSERT INTO shop_delta_stats SELECT 'menu',count(*) FROM public.shop_dish;
INSERT INTO shop_delta_stats SELECT 'schedule',count(*) FROM public.shop_schedule;
INSERT INTO shop_delta_stats SELECT 'submission',count(*) FROM public.shop_submission;

-- Tùng — kiểm chứng nội dung miền khác trong cùng snapshot transaction.
CREATE TEMP TABLE shop_delta_preservation(label TEXT PRIMARY KEY,query_text TEXT NOT NULL,
    row_count BIGINT NOT NULL,digest TEXT NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE shop_delta_sequences(sequence_name TEXT PRIMARY KEY,last_value BIGINT,is_called BOOLEAN NOT NULL) ON COMMIT DROP;
DO $shop_delta_capture$
DECLARE task_item RECORD; task_query TEXT; task_count BIGINT; task_digest TEXT; task_last BIGINT; task_called BOOLEAN;
BEGIN
    FOR task_item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN
        ('shop','shop_dish','shop_schedule','shop_submission','notification','admin_log') LOOP
        task_query:=format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %I.%I t',task_item.nspname,task_item.relname);
        EXECUTE task_query INTO task_count,task_digest;
        INSERT INTO pg_temp.shop_delta_preservation VALUES(task_item.relname,task_query,task_count,task_digest);
    END LOOP;
    task_query:=$q$SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),''))
      FROM public.notification t WHERE NOT(coalesce(ref_type::text='shop',false) OR type::text IN
        ('shop_pending_verification','shop_verified','shop_rejected','shop_identity_edit_pending','shop_identity_edit_accepted','shop_identity_edit_rejected'))$q$;
    EXECUTE task_query INTO task_count,task_digest;
    INSERT INTO pg_temp.shop_delta_preservation VALUES('notification_other_domains',task_query,task_count,task_digest);
    task_query:=$q$SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),''))
      FROM public.admin_log t WHERE target_type::text NOT IN ('shop','shop_dish')$q$;
    EXECUTE task_query INTO task_count,task_digest;
    INSERT INTO pg_temp.shop_delta_preservation VALUES('admin_log_other_domains',task_query,task_count,task_digest);
    FOR task_item IN SELECT DISTINCT format('%I.%I',n.nspname,s.relname) AS name
      FROM pg_class c JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      JOIN pg_class s ON s.oid=to_regclass(pg_get_serial_sequence(format('%I.%I',cn.nspname,c.relname),a.attname))
      JOIN pg_namespace n ON n.oid=s.relnamespace WHERE cn.nspname='public' AND c.relname IN
        ('shop','shop_dish','shop_schedule','shop_submission','notification','admin_log') LOOP
        EXECUTE format('SELECT last_value,is_called FROM %s',task_item.name) INTO task_last,task_called;
        INSERT INTO pg_temp.shop_delta_sequences VALUES(task_item.name,task_last,task_called);
    END LOOP;
END;
$shop_delta_capture$;

WITH removed AS (DELETE FROM public.notification WHERE ref_type::text='shop' OR type::text IN
    ('shop_pending_verification','shop_verified','shop_rejected','shop_identity_edit_pending','shop_identity_edit_accepted','shop_identity_edit_rejected') RETURNING 1)
INSERT INTO shop_delta_stats SELECT 'notification',count(*) FROM removed;
WITH removed AS (DELETE FROM public.admin_log WHERE target_type::text IN ('shop','shop_dish') RETURNING 1)
INSERT INTO shop_delta_stats SELECT 'admin_log',count(*) FROM removed;

-- Tùng — guards DELETE lịch sử vẫn hoạt động; reset vận hành đi qua TRUNCATE nhóm.
TRUNCATE TABLE public.shop_submission,public.shop_schedule,public.shop_dish,public.shop CONTINUE IDENTITY RESTRICT;

ALTER TABLE public.shop ADD COLUMN avt_shop_url TEXT NOT NULL;
ALTER TABLE public.shop ADD CONSTRAINT ck_shop_avatar_url_not_blank CHECK(length(btrim(avt_shop_url))>0);
ALTER TABLE public.shop_schedule ADD COLUMN slot_no SMALLINT NOT NULL;
ALTER TABLE public.shop_schedule ADD CONSTRAINT ck_shop_schedule_slot_no CHECK(slot_no>0);
DO $shop_delta_primary_key$
DECLARE task_name TEXT;
BEGIN
    SELECT conname INTO STRICT task_name FROM pg_constraint WHERE conrelid='public.shop_schedule'::regclass AND contype='p';
    EXECUTE format('ALTER TABLE public.shop_schedule DROP CONSTRAINT %I',task_name);
END;
$shop_delta_primary_key$;
ALTER TABLE public.shop_schedule ADD PRIMARY KEY(shop_id,day_of_week,slot_no);
ALTER TABLE public.shop_schedule DROP CONSTRAINT ck_shop_schedule_hours;
ALTER TABLE public.shop_schedule ADD CONSTRAINT ck_shop_schedule_hours CHECK(
    (is_closed AND slot_no=1 AND open_time IS NULL AND close_time IS NULL)
    OR (NOT is_closed AND open_time IS NOT NULL AND close_time IS NOT NULL
      AND open_time<TIME '24:00' AND close_time<TIME '24:00'
      AND EXTRACT(SECOND FROM open_time)=0 AND EXTRACT(SECOND FROM close_time)=0 AND close_time>open_time));

CREATE OR REPLACE FUNCTION public.guard_shop_schedule_write() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE task_shop_id BIGINT;
BEGIN
    IF TG_OP='UPDATE' AND (NEW.shop_id,NEW.day_of_week,NEW.slot_no) IS DISTINCT FROM (OLD.shop_id,OLD.day_of_week,OLD.slot_no) THEN
        RAISE EXCEPTION 'Schedule key is immutable' USING ERRCODE='23514';
    END IF;
    IF TG_OP='DELETE' THEN task_shop_id:=OLD.shop_id; ELSE task_shop_id:=NEW.shop_id; END IF;
    UPDATE public.shop SET row_version=row_version WHERE shop_id=task_shop_id;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_shop_schedule_complete() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE task_shop_id BIGINT;
BEGIN
    IF TG_OP='DELETE' THEN task_shop_id:=OLD.shop_id; ELSE task_shop_id:=NEW.shop_id; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.shop WHERE shop_id=task_shop_id) THEN RETURN NULL; END IF;
    IF (SELECT count(DISTINCT day_of_week) FROM public.shop_schedule WHERE shop_id=task_shop_id)<>7
      OR NOT EXISTS(SELECT 1 FROM public.shop_schedule WHERE shop_id=task_shop_id AND NOT is_closed) THEN
        RAISE EXCEPTION 'Shop % requires seven distinct schedule days and at least one open day',task_shop_id USING ERRCODE='23514';
    END IF;
    IF EXISTS(SELECT 1 FROM public.shop_schedule WHERE shop_id=task_shop_id GROUP BY day_of_week
      HAVING bool_or(is_closed) AND (count(*)<>1 OR NOT bool_and(is_closed))) THEN
        RAISE EXCEPTION 'A closed day requires exactly one closed row and no open rows' USING ERRCODE='23514';
    END IF;
    IF EXISTS(SELECT 1 FROM public.shop_schedule x JOIN public.shop_schedule y
      ON x.shop_id=y.shop_id AND x.day_of_week=y.day_of_week AND x.slot_no<y.slot_no
      WHERE x.shop_id=task_shop_id AND NOT x.is_closed AND NOT y.is_closed
        AND x.open_time<y.close_time AND y.open_time<x.close_time) THEN
        RAISE EXCEPTION 'Schedule slots cannot overlap' USING ERRCODE='23514';
    END IF;
    RETURN NULL;
END;
$$;

-- Tùng — canonical JSON schedule: seven days, slots ordered by opening time.
CREATE FUNCTION public.valid_shop_schedule_snapshot(task_schedule JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE task_day JSONB; task_slot JSONB; task_seen INT[]:='{}'; task_day_number INT; task_open_days INT:=0;
    task_start TIME; task_end TIME; task_previous_end TIME;
BEGIN
    IF task_schedule IS NULL OR jsonb_typeof(task_schedule) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
    IF jsonb_array_length(task_schedule)<>7 THEN RETURN FALSE; END IF;
    FOR task_day IN SELECT value FROM jsonb_array_elements(task_schedule) LOOP
        IF jsonb_typeof(task_day) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
        IF NOT task_day ?& ARRAY['dayOfWeek','isClosed','slots'] OR task_day-ARRAY['dayOfWeek','isClosed','slots']<>'{}'::jsonb
          OR jsonb_typeof(task_day->'dayOfWeek') IS DISTINCT FROM 'number' OR (task_day->>'dayOfWeek')!~'^[1-7]$'
          OR jsonb_typeof(task_day->'isClosed') IS DISTINCT FROM 'boolean'
          OR jsonb_typeof(task_day->'slots') IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
        task_day_number:=(task_day->>'dayOfWeek')::INT;
        IF task_day_number=ANY(task_seen) THEN RETURN FALSE; END IF;
        task_seen:=array_append(task_seen,task_day_number);
        IF (task_day->>'isClosed')::BOOLEAN THEN
            IF jsonb_array_length(task_day->'slots')<>0 THEN RETURN FALSE; END IF;
        ELSE
            IF jsonb_array_length(task_day->'slots')=0 THEN RETURN FALSE; END IF;
            task_open_days:=task_open_days+1; task_previous_end:=NULL;
            FOR task_slot IN SELECT value FROM jsonb_array_elements(task_day->'slots') LOOP
                IF jsonb_typeof(task_slot) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
                IF NOT task_slot ?& ARRAY['openTime','closeTime'] OR task_slot-ARRAY['openTime','closeTime']<>'{}'::jsonb
                  OR jsonb_typeof(task_slot->'openTime') IS DISTINCT FROM 'string'
                  OR jsonb_typeof(task_slot->'closeTime') IS DISTINCT FROM 'string'
                  OR (task_slot->>'openTime')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
                  OR (task_slot->>'closeTime')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN FALSE; END IF;
                task_start:=(task_slot->>'openTime')::TIME; task_end:=(task_slot->>'closeTime')::TIME;
                IF task_end<=task_start OR (task_previous_end IS NOT NULL AND task_start<task_previous_end) THEN RETURN FALSE; END IF;
                task_previous_end:=task_end;
            END LOOP;
        END IF;
    END LOOP;
    RETURN task_open_days>0;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation OR invalid_parameter_value THEN RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.valid_shop_form_snapshot(task_snapshot JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
    IF task_snapshot IS NULL OR jsonb_typeof(task_snapshot) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
    IF NOT task_snapshot ?& ARRAY['name','address','phone','avtShopUrl','schedule']
      OR task_snapshot-ARRAY['name','address','phone','avtShopUrl','schedule']<>'{}'::jsonb
      OR jsonb_typeof(task_snapshot->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(task_snapshot->'address') IS DISTINCT FROM 'string'
      OR jsonb_typeof(task_snapshot->'phone') IS DISTINCT FROM 'string'
      OR jsonb_typeof(task_snapshot->'avtShopUrl') IS DISTINCT FROM 'string'
      OR length(btrim(task_snapshot->>'name')) NOT BETWEEN 1 AND 200
      OR length(btrim(task_snapshot->>'address')) NOT BETWEEN 1 AND 300
      OR length(btrim(task_snapshot->>'phone')) NOT BETWEEN 1 AND 20
      OR length(btrim(task_snapshot->>'avtShopUrl'))=0 THEN RETURN FALSE; END IF;
    RETURN public.valid_shop_schedule_snapshot(task_snapshot->'schedule');
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_shop_submission() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE task_key TEXT; task_limit INT; task_owner BIGINT; task_state public.shop_verification_status_enum;
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Submission history cannot be deleted' USING ERRCODE='23514';
    ELSIF TG_OP='UPDATE' THEN
        IF (NEW.shop_submission_id,NEW.shop_id,NEW.submission_type,NEW.before_value,NEW.after_value,NEW.submitted_by,NEW.submitted_at)
          IS DISTINCT FROM (OLD.shop_submission_id,OLD.shop_id,OLD.submission_type,OLD.before_value,OLD.after_value,OLD.submitted_by,OLD.submitted_at)
          OR OLD.status<>'pending' OR NEW.status NOT IN ('accepted','rejected') THEN
            RAISE EXCEPTION 'Only one terminal outcome may change a pending submission' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.status<>'pending' THEN RAISE EXCEPTION 'New submissions must start pending' USING ERRCODE='23514'; END IF;
    IF jsonb_typeof(NEW.after_value) IS DISTINCT FROM 'object'
      OR (NEW.before_value IS NOT NULL AND jsonb_typeof(NEW.before_value) IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION 'Snapshots must be JSON objects' USING ERRCODE='23514';
    END IF;
    SELECT owner_account_id,verification_status INTO task_owner,task_state FROM public.shop WHERE shop_id=NEW.shop_id FOR UPDATE;
    IF task_owner IS NULL OR task_owner<>NEW.submitted_by
      OR (NEW.submission_type='identity_edit' AND task_state<>'verified')
      OR (NEW.submission_type IN ('registration','resubmission') AND task_state<>'pending') THEN
        RAISE EXCEPTION 'Submission owner or Shop state mismatch' USING ERRCODE='23514';
    END IF;
    IF NEW.submission_type='identity_edit' THEN
        IF NEW.before_value IS NULL OR NEW.after_value='{}'::jsonb
          OR NEW.before_value-ARRAY['name','address','phone','avtShopUrl']<>'{}'::jsonb
          OR NEW.after_value-ARRAY['name','address','phone','avtShopUrl']<>'{}'::jsonb
          OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.before_value) AS keys(key))
            IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.after_value) AS keys(key)) THEN
            RAISE EXCEPTION 'Identity snapshots require the same nonempty identity keys' USING ERRCODE='23514';
        END IF;
        FOR task_key IN SELECT jsonb_object_keys(NEW.after_value) LOOP
            IF jsonb_typeof(NEW.before_value->task_key) IS DISTINCT FROM 'string'
              OR jsonb_typeof(NEW.after_value->task_key) IS DISTINCT FROM 'string'
              OR length(btrim(NEW.after_value->>task_key))=0 OR NEW.before_value->task_key=NEW.after_value->task_key THEN
                RAISE EXCEPTION 'Identity patch must contain changed valid strings' USING ERRCODE='23514';
            END IF;
            IF task_key='avtShopUrl' THEN
                IF length(btrim(NEW.before_value->>task_key))=0 THEN RAISE EXCEPTION 'Previous Shop avatar must be nonblank' USING ERRCODE='23514'; END IF;
            ELSE
                task_limit:=CASE task_key WHEN 'name' THEN 200 WHEN 'address' THEN 300 WHEN 'phone' THEN 20 END;
                IF length(btrim(NEW.after_value->>task_key))>task_limit THEN RAISE EXCEPTION 'Identity value is too long' USING ERRCODE='23514'; END IF;
            END IF;
        END LOOP;
    ELSIF NOT public.valid_shop_form_snapshot(NEW.after_value)
      OR (NEW.submission_type='registration' AND NEW.before_value IS NOT NULL)
      OR (NEW.submission_type='resubmission' AND NOT public.valid_shop_form_snapshot(NEW.before_value)) THEN
        RAISE EXCEPTION 'Registration snapshots require the complete validated form' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.shop.avt_shop_url IS 'Shop-owned Cloudinary URL; required, independent of account avatar. Verified changes apply after identity_edit acceptance.';
COMMENT ON COLUMN public.shop_schedule.slot_no IS 'Positive slot number derived by backend from canonical ordered slots; closed day uses slot 1.';
COMMENT ON TABLE public.shop_schedule IS 'shop_avatar_schedule_v1: seven distinct Vietnam-local days; open day has nonoverlapping slots, closed day one NULL-hours row.';
COMMENT ON FUNCTION public.valid_shop_schedule_snapshot(JSONB) IS 'shop_avatar_schedule_v1: validates seven canonical days with ordered nonoverlapping slots.';

DO $shop_delta_verify_preservation$
DECLARE task_item RECORD; task_count BIGINT; task_digest TEXT; task_last BIGINT; task_called BOOLEAN;
BEGIN
    IF EXISTS(SELECT 1 FROM public.shop) OR EXISTS(SELECT 1 FROM public.shop_dish)
      OR EXISTS(SELECT 1 FROM public.shop_schedule) OR EXISTS(SELECT 1 FROM public.shop_submission) THEN
        RAISE EXCEPTION 'Shop reset did not produce an empty baseline';
    END IF;
    IF EXISTS(SELECT 1 FROM public.notification WHERE ref_type::text='shop' OR type::text IN
      ('shop_pending_verification','shop_verified','shop_rejected','shop_identity_edit_pending','shop_identity_edit_accepted','shop_identity_edit_rejected'))
      OR EXISTS(SELECT 1 FROM public.admin_log WHERE target_type::text IN ('shop','shop_dish')) THEN
        RAISE EXCEPTION 'Shop soft references remain after reset';
    END IF;
    FOR task_item IN SELECT * FROM pg_temp.shop_delta_preservation LOOP
        EXECUTE task_item.query_text INTO task_count,task_digest;
        IF (task_count,task_digest) IS DISTINCT FROM (task_item.row_count,task_item.digest) THEN
            RAISE EXCEPTION 'Data outside Shop scope changed: %',task_item.label;
        END IF;
    END LOOP;
    FOR task_item IN SELECT * FROM pg_temp.shop_delta_sequences LOOP
        EXECUTE format('SELECT last_value,is_called FROM %s',task_item.sequence_name) INTO task_last,task_called;
        IF (task_last,task_called) IS DISTINCT FROM (task_item.last_value,task_item.is_called) THEN
            RAISE EXCEPTION 'Sequence state changed: %',task_item.sequence_name;
        END IF;
    END LOOP;
END;
$shop_delta_verify_preservation$;

SET CONSTRAINTS ALL IMMEDIATE;
SELECT 'shop_avatar_schedule_v1' AS revision,true AS passed,
    (SELECT jsonb_object_agg(kind,amount) FROM pg_temp.shop_delta_stats) AS removed_rows,
    (SELECT count(*) FROM pg_temp.shop_delta_preservation) AS protected_data_groups_verified,
    (SELECT count(*) FROM pg_temp.shop_delta_sequences) AS sequence_states_preserved;
COMMIT;
