-- Tùng — Sprint 2: in-place migration cho DB hiện có, chạy một lần qua Neon SQL Editor.
-- Dùng toàn bộ file. Không dùng fresh schema/seed/reset 04/10 trên DB có dữ liệu.
-- Nếu bất kỳ câu lệnh lỗi: transaction không COMMIT; chạy ROLLBACK nếu editor giữ session.
-- Không chạy khi preflight còn BLOCKER. Script không tự sửa giá hoặc đoán lịch.
BEGIN;
SET LOCAL search_path = public, pg_temp;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Tùng — Sprint 2: chặn writer trong lúc kiểm tra, ALTER và backfill để không lệch dữ liệu.
LOCK TABLE public.shop, public.shop_dish, public.notification IN ACCESS EXCLUSIVE MODE;

DO $shop_migration_preflight$
DECLARE task_items TEXT;
BEGIN
    SELECT string_agg(item, ', ' ORDER BY item) INTO task_items
    FROM (
        SELECT 'table ' || name AS item
        FROM (VALUES ('shop_schedule'), ('shop_submission')) names(name)
        WHERE to_regclass('public.' || name) IS NOT NULL
        UNION ALL
        SELECT 'column ' || c.table_name || '.' || c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND (c.table_name,c.column_name) IN
              (('shop','row_version'),('shop_dish','row_version'),('notification','metadata'))
        UNION ALL
        SELECT 'function ' || p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN
            ('bump_shop_row_version','guard_shop_dish_update','guard_shop_schedule_write',
             'check_shop_schedule_complete','valid_shop_form_snapshot','guard_shop_submission')
        UNION ALL
        SELECT 'index ' || name
        FROM (VALUES ('uq_shop_dish_shop_dish'),('uq_shop_submission_pending'),
                     ('idx_shop_submission_pending_queue'),('idx_shop_submission_history')) names(name)
        WHERE to_regclass('public.' || name) IS NOT NULL
    ) collisions;
    IF task_items IS NOT NULL THEN
        RAISE EXCEPTION 'Shop migration already installed or schema conflict: %', task_items
            USING HINT = 'Do not rerun or drop objects. Run the read-only verify file and review the existing schema.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE a.attrelid = 'public.notification'::regclass AND a.attname = 'type'
          AND NOT a.attisdropped AND t.typtype = 'e'
          AND n.nspname = 'public' AND t.typname = 'notification_type_enum'
    ) THEN
        RAISE EXCEPTION 'notification.type must use public.notification_type_enum';
    END IF;

    SELECT string_agg(shop_dish_id::text, ', ' ORDER BY shop_dish_id) INTO task_items
    FROM public.shop_dish
    WHERE price IS NULL OR price = 'NaN'::numeric OR price < 0 OR price <> trunc(price);
    IF task_items IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid menu price; shop_dish IDs: %', task_items
            USING HINT = 'Correct the source data in a separate task. This migration never rounds or fills prices.';
    END IF;

    SELECT string_agg(shop_id::text || '/' || dish_id::text, ', ') INTO task_items
    FROM (SELECT shop_id,dish_id FROM public.shop_dish
          GROUP BY shop_id,dish_id HAVING count(*) > 1) duplicates;
    IF task_items IS NOT NULL THEN
        RAISE EXCEPTION 'Duplicate Shop/Dish links: %', task_items
            USING HINT = 'Review duplicate data separately; this migration does not delete menu rows.';
    END IF;

    SELECT string_agg(shop_id::text, ', ' ORDER BY shop_id) INTO task_items
    FROM public.shop
    WHERE (open_days IN ('T2-CN','T2-T7')) IS NOT TRUE
       OR open_time IS NULL OR close_time IS NULL
       OR open_time >= TIME '24:00' OR close_time >= TIME '24:00'
       OR EXTRACT(SECOND FROM open_time) <> 0 OR EXTRACT(SECOND FROM close_time) <> 0
       OR close_time <= open_time;
    IF task_items IS NOT NULL THEN
        RAISE EXCEPTION 'Unknown or invalid legacy schedule; Shop IDs: %', task_items
            USING HINT = 'Only exact T2-CN and T2-T7 encodings with valid same-day minute hours are supported.';
    END IF;
END;
$shop_migration_preflight$;

-- Tùng — Sprint 2: enum chỉ được dùng sau COMMIT; migration này không insert type mới.
ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'shop_identity_edit_pending';
ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'shop_identity_edit_accepted';
ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'shop_identity_edit_rejected';


-- Tùng — Sprint 2: bảng/cột và constraints theo contract Shop, giữ dữ liệu nền.
ALTER TABLE public.shop ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1
    CONSTRAINT ck_shop_row_version CHECK (row_version > 0);
ALTER TABLE public.shop_dish ADD COLUMN row_version BIGINT NOT NULL DEFAULT 1
    CONSTRAINT ck_shop_dish_row_version CHECK (row_version > 0);
ALTER TABLE public.shop_dish ALTER COLUMN price SET NOT NULL;
ALTER TABLE public.shop_dish ADD CONSTRAINT ck_shop_dish_price_integer_vnd
    CHECK (price <> 'NaN'::numeric AND price >= 0 AND price = trunc(price));
ALTER TABLE public.shop_dish ADD CONSTRAINT uq_shop_dish_shop_dish UNIQUE (shop_id, dish_id);
ALTER TABLE public.notification ADD COLUMN metadata JSONB
    CONSTRAINT ck_notification_metadata_object CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');

CREATE TABLE public.shop_schedule (
    shop_id BIGINT NOT NULL REFERENCES public.shop(shop_id) ON DELETE RESTRICT,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    is_closed BOOLEAN NOT NULL,
    open_time TIME WITHOUT TIME ZONE,
    close_time TIME WITHOUT TIME ZONE,
    PRIMARY KEY (shop_id, day_of_week),
    CONSTRAINT ck_shop_schedule_hours CHECK (
        (is_closed AND open_time IS NULL AND close_time IS NULL)
        OR (NOT is_closed AND open_time IS NOT NULL AND close_time IS NOT NULL
            AND open_time < TIME '24:00' AND close_time < TIME '24:00'
            AND EXTRACT(SECOND FROM open_time) = 0 AND EXTRACT(SECOND FROM close_time) = 0
            AND close_time > open_time)
    )
);
COMMENT ON TABLE public.shop_schedule IS 'Canonical local Vietnam wall time; 1=Monday, 7=Sunday. Seven rows and at least one open day required at commit.';
COMMENT ON COLUMN public.shop.open_days IS 'Legacy common schedule only. New consumers read shop_schedule; do not flatten heterogeneous hours.';

-- Tùng — Sprint 2: backfill trước khi cài trigger; giữ updated_at và version=1 của Shop cũ.
-- T2-CN -> cả bảy ngày; T2-T7 -> T2..T7 mở, CN nghỉ. Không thay các cột lịch cũ.
INSERT INTO public.shop_schedule (shop_id, day_of_week, is_closed, open_time, close_time)
SELECT s.shop_id, days.day_no::smallint,
       s.open_days = 'T2-T7' AND days.day_no = 7,
       CASE WHEN s.open_days = 'T2-T7' AND days.day_no = 7 THEN NULL ELSE s.open_time END,
       CASE WHEN s.open_days = 'T2-T7' AND days.day_no = 7 THEN NULL ELSE s.close_time END
FROM public.shop s CROSS JOIN generate_series(1,7) AS days(day_no);

DO $shop_schedule_backfill$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.shop s LEFT JOIN public.shop_schedule sc ON sc.shop_id = s.shop_id
        GROUP BY s.shop_id HAVING count(sc.day_of_week) <> 7
            OR count(sc.day_of_week) FILTER (WHERE NOT sc.is_closed) = 0
    ) THEN
        RAISE EXCEPTION 'Schedule backfill must produce seven rows and at least one open day per Shop';
    END IF;
END;
$shop_schedule_backfill$;

-- Tùng — Sprint 2: version triggers; không thay trigger updated_at đang có.
CREATE FUNCTION public.bump_shop_row_version() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.row_version := OLD.row_version + 1;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_shop_row_version BEFORE UPDATE ON public.shop
    FOR EACH ROW EXECUTE FUNCTION public.bump_shop_row_version();

CREATE FUNCTION public.guard_shop_dish_update() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.shop_dish_id IS DISTINCT FROM OLD.shop_dish_id
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.dish_id IS DISTINCT FROM OLD.dish_id THEN
        RAISE EXCEPTION 'A menu row cannot change its Shop or Dish' USING ERRCODE = '23514';
    END IF;
    NEW.row_version := OLD.row_version + 1;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_shop_dish_guard_update BEFORE UPDATE ON public.shop_dish
    FOR EACH ROW EXECUTE FUNCTION public.guard_shop_dish_update();

-- Tùng — Sprint 2: schedule writers lock parent.
-- Every schedule writer locks the same parent before changing child rows.
-- Backend locks Shop first, checks expectedVersion, then replaces all seven days.
CREATE FUNCTION public.guard_shop_schedule_write() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE task_shop_id BIGINT;
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.day_of_week IS DISTINCT FROM OLD.day_of_week) THEN
        RAISE EXCEPTION 'Schedule key is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN task_shop_id := OLD.shop_id;
    ELSE task_shop_id := NEW.shop_id; END IF;
    UPDATE public.shop SET row_version = row_version WHERE shop_id = task_shop_id;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_shop_schedule_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.shop_schedule
    FOR EACH ROW EXECUTE FUNCTION public.guard_shop_schedule_write();

CREATE FUNCTION public.check_shop_schedule_complete() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE task_shop_id BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN task_shop_id := OLD.shop_id;
    ELSE task_shop_id := NEW.shop_id; END IF;
    IF EXISTS (SELECT 1 FROM public.shop WHERE shop_id = task_shop_id) AND
       ((SELECT count(*) FROM public.shop_schedule WHERE shop_id = task_shop_id) <> 7
        OR NOT EXISTS (SELECT 1 FROM public.shop_schedule WHERE shop_id = task_shop_id AND NOT is_closed)) THEN
        RAISE EXCEPTION 'Shop % requires seven schedule rows and at least one open day', task_shop_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_shop_schedule_complete AFTER INSERT OR UPDATE OR DELETE ON public.shop_schedule
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_shop_schedule_complete();
CREATE CONSTRAINT TRIGGER trg_shop_initial_schedule AFTER INSERT ON public.shop
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_shop_schedule_complete();

CREATE TABLE public.shop_submission (
    shop_submission_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES public.shop(shop_id) ON DELETE RESTRICT,
    submission_type TEXT NOT NULL CHECK (submission_type IN ('registration','resubmission','identity_edit')),
    before_value JSONB,
    after_value JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    submitted_by BIGINT NOT NULL REFERENCES public.account(account_id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by BIGINT REFERENCES public.account(account_id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    review_note VARCHAR(255),
    CONSTRAINT ck_shop_submission_snapshot_objects CHECK (
        jsonb_typeof(after_value) = 'object'
        AND (before_value IS NULL OR jsonb_typeof(before_value) = 'object')
        AND (submission_type = 'registration' OR before_value IS NOT NULL)),
    CONSTRAINT ck_shop_submission_outcome CHECK (
        (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
        OR (status IN ('accepted','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
            AND reviewed_at >= submitted_at
            AND (status = 'accepted' OR NULLIF(btrim(review_note), '') IS NOT NULL)))
);
CREATE UNIQUE INDEX uq_shop_submission_pending ON public.shop_submission(shop_id) WHERE status = 'pending';
CREATE INDEX idx_shop_submission_pending_queue ON public.shop_submission(submitted_at, shop_submission_id) WHERE status = 'pending';
CREATE INDEX idx_shop_submission_history ON public.shop_submission(shop_id, submitted_at DESC, shop_submission_id DESC);

-- Tùng — Sprint 2: immutable form/identity snapshots and terminal outcomes.
-- Form JSON: {name,address,phone,schedule:[{dayOfWeek,isClosed,openTime,closeTime},...]}
-- Identity JSON: only changed name/address/phone keys; before/after have same keys.
CREATE FUNCTION public.valid_shop_form_snapshot(task_snapshot JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE task_day JSONB; task_seen INT[] := '{}'; task_number INT; task_open INT := 0;
BEGIN
    IF task_snapshot IS NULL OR jsonb_typeof(task_snapshot) <> 'object'
       OR NOT task_snapshot ?& ARRAY['name','address','phone','schedule']
       OR task_snapshot - ARRAY['name','address','phone','schedule'] <> '{}'::jsonb
       OR jsonb_typeof(task_snapshot->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(task_snapshot->'address') IS DISTINCT FROM 'string'
       OR jsonb_typeof(task_snapshot->'phone') IS DISTINCT FROM 'string'
       OR length(btrim(task_snapshot->>'name')) NOT BETWEEN 1 AND 200
       OR length(btrim(task_snapshot->>'address')) NOT BETWEEN 1 AND 300
       OR length(btrim(task_snapshot->>'phone')) NOT BETWEEN 1 AND 20
       OR jsonb_typeof(task_snapshot->'schedule') IS DISTINCT FROM 'array'
       OR jsonb_array_length(task_snapshot->'schedule') <> 7 THEN RETURN FALSE; END IF;
    FOR task_day IN SELECT value FROM jsonb_array_elements(task_snapshot->'schedule') LOOP
        IF jsonb_typeof(task_day) <> 'object'
           OR NOT task_day ?& ARRAY['dayOfWeek','isClosed','openTime','closeTime']
           OR task_day - ARRAY['dayOfWeek','isClosed','openTime','closeTime'] <> '{}'::jsonb
           OR jsonb_typeof(task_day->'dayOfWeek') IS DISTINCT FROM 'number'
           OR (task_day->>'dayOfWeek') !~ '^[1-7]$'
           OR jsonb_typeof(task_day->'isClosed') IS DISTINCT FROM 'boolean' THEN RETURN FALSE; END IF;
        task_number := (task_day->>'dayOfWeek')::INT;
        IF task_number = ANY(task_seen) THEN RETURN FALSE; END IF;
        task_seen := array_append(task_seen, task_number);
        IF (task_day->>'isClosed')::BOOLEAN THEN
            IF task_day->'openTime' <> 'null'::jsonb OR task_day->'closeTime' <> 'null'::jsonb THEN RETURN FALSE; END IF;
        ELSE
            IF jsonb_typeof(task_day->'openTime') IS DISTINCT FROM 'string'
               OR jsonb_typeof(task_day->'closeTime') IS DISTINCT FROM 'string'
               OR (task_day->>'openTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
               OR (task_day->>'closeTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
               OR (task_day->>'closeTime')::TIME <= (task_day->>'openTime')::TIME THEN RETURN FALSE; END IF;
            task_open := task_open + 1;
        END IF;
    END LOOP;
    RETURN task_open > 0;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RETURN FALSE;
END;
$$;

CREATE FUNCTION public.guard_shop_submission() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE task_key TEXT; task_limit INT; task_owner BIGINT; task_state public.shop_verification_status_enum;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Submission history cannot be deleted' USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.shop_submission_id,NEW.shop_id,NEW.submission_type,NEW.before_value,NEW.after_value,NEW.submitted_by,NEW.submitted_at)
           IS DISTINCT FROM (OLD.shop_submission_id,OLD.shop_id,OLD.submission_type,OLD.before_value,OLD.after_value,OLD.submitted_by,OLD.submitted_at)
           OR OLD.status <> 'pending' OR NEW.status NOT IN ('accepted','rejected') THEN
            RAISE EXCEPTION 'Only one terminal outcome may change a pending submission' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.status <> 'pending' THEN
        RAISE EXCEPTION 'New submissions must start pending' USING ERRCODE = '23514';
    END IF;
    IF jsonb_typeof(NEW.after_value) IS DISTINCT FROM 'object'
       OR (NEW.before_value IS NOT NULL AND jsonb_typeof(NEW.before_value) IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION 'Snapshots must be JSON objects' USING ERRCODE = '23514';
    END IF;
    SELECT owner_account_id, verification_status INTO task_owner,task_state
        FROM public.shop WHERE shop_id = NEW.shop_id FOR UPDATE;
    IF task_owner IS NULL OR task_owner <> NEW.submitted_by
       OR (NEW.submission_type = 'identity_edit' AND task_state <> 'verified')
       OR (NEW.submission_type IN ('registration','resubmission') AND task_state <> 'pending') THEN
        RAISE EXCEPTION 'Submission owner or Shop state mismatch' USING ERRCODE = '23514';
    END IF;
    IF NEW.submission_type = 'identity_edit' THEN
        IF NEW.before_value IS NULL OR NEW.after_value = '{}'::jsonb
           OR NEW.before_value - ARRAY['name','address','phone'] <> '{}'::jsonb
           OR NEW.after_value - ARRAY['name','address','phone'] <> '{}'::jsonb
           OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.before_value) AS keys(key))
              IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.after_value) AS keys(key)) THEN
            RAISE EXCEPTION 'Identity snapshots require the same nonempty identity keys' USING ERRCODE = '23514';
        END IF;
        FOR task_key IN SELECT jsonb_object_keys(NEW.after_value) LOOP
            task_limit := CASE task_key WHEN 'name' THEN 200 WHEN 'address' THEN 300 ELSE 20 END;
            IF jsonb_typeof(NEW.before_value->task_key) IS DISTINCT FROM 'string'
               OR jsonb_typeof(NEW.after_value->task_key) IS DISTINCT FROM 'string'
               OR length(btrim(NEW.after_value->>task_key)) NOT BETWEEN 1 AND task_limit
               OR NEW.before_value->task_key = NEW.after_value->task_key THEN
                RAISE EXCEPTION 'Identity patch must contain changed valid strings' USING ERRCODE = '23514';
            END IF;
        END LOOP;
    ELSIF NOT public.valid_shop_form_snapshot(NEW.after_value)
          OR (NEW.submission_type = 'registration' AND NEW.before_value IS NOT NULL)
          OR (NEW.submission_type = 'resubmission' AND NOT public.valid_shop_form_snapshot(NEW.before_value)) THEN
        RAISE EXCEPTION 'Registration snapshots require the complete validated form' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_shop_submission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.shop_submission
    FOR EACH ROW EXECUTE FUNCTION public.guard_shop_submission();

COMMENT ON TABLE public.shop_submission IS 'Immutable Member submissions, with one pending row per Shop and one terminal review. Backend atomically applies Shop patch, AdminLog and Notification.';

-- Tùng — Sprint 2: legacy pending recapture là file riêng, không dựng lịch sử tại đây.
COMMIT;
