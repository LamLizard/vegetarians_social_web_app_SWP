-- Tùng — Sprint 2: bước riêng SAU migration, nếu đưa Shop 4 pending cũ vào queue mới.
-- Snapshot dữ liệu hiện tại; submitted_at là lúc chạy, không phải thời điểm đăng ký cũ.
-- submitted_by ghi owner hiện có theo contract. Người vận hành chạy thay cho recapture.
-- Không tạo hồ sơ accepted/rejected lịch sử, không thay Shop/giá/lịch, không giả AdminLog.
BEGIN;
SET LOCAL search_path = public, pg_temp;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

DO $shop_pending_recapture$
DECLARE
    task_shop public.shop%ROWTYPE;
    task_snapshot JSONB;
    task_submission_id BIGINT;
    task_notification_count INTEGER;
BEGIN
    -- Tùng — Sprint 2: khóa Account rồi Shop, cùng thứ tự registration; chỉ Shop đã đối chiếu.
    PERFORM 1 FROM public.account WHERE account_id = 10 FOR UPDATE;
    SELECT * INTO task_shop FROM public.shop WHERE shop_id = 4 FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Legacy Shop 4 does not exist; review the target database';
    END IF;
    IF task_shop.owner_account_id <> 10
       OR task_shop.name <> 'Bếp Hạt Và Rau' THEN
        RAISE EXCEPTION 'Shop 4 no longer matches the inspected legacy Shop; review before recapture';
    END IF;

    -- Tùng — Sprint 2: chạy lại không tạo hồ sơ/notification trùng sau lần recapture đầu.
    IF EXISTS (SELECT 1 FROM public.shop_submission WHERE shop_id = task_shop.shop_id) THEN
        RAISE NOTICE 'Shop 4 already has submission history. No recapture or notifications added.';
        RETURN;
    END IF;
    IF task_shop.verification_status::text <> 'pending' THEN
        RAISE EXCEPTION 'Shop 4 must still be pending; do not recreate historical outcomes';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.account a JOIN public.role r ON r.role_id = a.role_id
        WHERE a.account_id = task_shop.owner_account_id AND r.name = 'member'
    ) THEN
        RAISE EXCEPTION 'Legacy pending owner must be a Member';
    END IF;
    IF NULLIF(btrim(task_shop.name), '') IS NULL
       OR NULLIF(btrim(task_shop.address), '') IS NULL
       OR task_shop.phone IS NULL OR task_shop.phone !~ '^0([35789][0-9]{8}|2[0-9]{9})$' THEN
        RAISE EXCEPTION 'Legacy Shop identity must be valid before present-time recapture';
    END IF;

    SELECT jsonb_build_object(
        'name', task_shop.name, 'address', task_shop.address, 'phone', task_shop.phone,
        'schedule', jsonb_agg(jsonb_build_object(
            'dayOfWeek', sc.day_of_week, 'isClosed', sc.is_closed,
            'openTime', to_char(sc.open_time, 'HH24:MI'),
            'closeTime', to_char(sc.close_time, 'HH24:MI')
        ) ORDER BY sc.day_of_week)
    ) INTO task_snapshot
    FROM public.shop_schedule sc WHERE sc.shop_id = task_shop.shop_id;
    IF NOT public.valid_shop_form_snapshot(task_snapshot) THEN
        RAISE EXCEPTION 'Legacy Shop requires a complete valid current snapshot';
    END IF;

    INSERT INTO public.shop_submission
        (shop_id, submission_type, before_value, after_value, submitted_by, submitted_at)
    VALUES (task_shop.shop_id, 'registration', NULL, task_snapshot,
            task_shop.owner_account_id, clock_timestamp())
    RETURNING shop_submission_id INTO task_submission_id;

    -- Tùng — Sprint 2: Admin biết đây là hồ sơ recapture; không lùi ngày notification.
    INSERT INTO public.notification (account_id, type, title, content, ref_type, ref_id, metadata)
    SELECT a.account_id, 'shop_pending_verification', 'Hồ sơ quán chờ xác minh',
           task_shop.name || ': hồ sơ pending cũ được chụp lại từ dữ liệu hiện tại khi tích hợp Sprint 2.',
           'shop', task_shop.shop_id,
           jsonb_build_object('submissionId', task_submission_id::text,
                              'submissionType', 'registration',
                              'source', 'legacy_pending_recapture_2026_10_07')
    FROM public.account a JOIN public.role r ON r.role_id = a.role_id
    WHERE r.name = 'admin';
    GET DIAGNOSTICS task_notification_count = ROW_COUNT;
    RAISE NOTICE 'Created current snapshot submission % for Shop 4; Admin notifications: %',
        task_submission_id, task_notification_count;
END;
$shop_pending_recapture$;

COMMIT;
