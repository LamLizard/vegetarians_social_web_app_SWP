-- Read-only checks for this exact fresh DEMO dataset after base + social_50.
-- Every row must return passed=true. Counts are fixture-specific, not production invariants.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = public;

SELECT check_name, passed FROM (VALUES
    ('application_tables_29', (SELECT count(*)=29 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')),
    ('accounts_58', (SELECT count(*)=58 FROM account)),
    ('members_54_admins_4', (SELECT count(*) FILTER (WHERE r.name='member')=54 AND count(*) FILTER (WHERE r.name='admin')=4 FROM account a JOIN role r USING(role_id))),
    ('posts_82_comments_197', (SELECT count(*)=82 FROM post) AND (SELECT count(*)=197 FROM comment)),
    ('votes_949', (SELECT count(*)=949 FROM post_vote)),
    ('report_cases_40_reports_86', (SELECT count(*)=40 FROM report_case) AND (SELECT count(*)=86 FROM report)),
    ('notifications_117_admin_logs_83', (SELECT count(*)=117 FROM notification) AND (SELECT count(*)=83 FROM admin_log)),
    ('post_counters_public_comments', NOT EXISTS (
        SELECT 1 FROM post p WHERE p.vote_count<>(SELECT count(*) FROM post_vote v WHERE v.post_id=p.post_id)
           OR p.comment_count<>(SELECT count(*) FROM comment c WHERE c.post_id=p.post_id AND c.status='public'))),
    ('report_case_matches_reports', NOT EXISTS (
        SELECT 1 FROM report r JOIN report_case rc USING(case_id)
        WHERE r.target_type<>rc.target_type OR r.target_id<>rc.target_id OR r.status<>rc.status)),
    ('shops_5_menu_rows_20', (SELECT count(*)=5 FROM shop) AND (SELECT count(*)=20 FROM shop_dish)),
    ('menu_integer_vnd_and_unique_pairs', NOT EXISTS (
        SELECT 1 FROM shop_dish WHERE price IS NULL OR price='NaN'::numeric OR price<0 OR price<>trunc(price))
        AND NOT EXISTS (SELECT 1 FROM shop_dish GROUP BY shop_id,dish_id HAVING count(*)>1)),
    ('versions_positive', NOT EXISTS (SELECT 1 FROM shop WHERE row_version<1)
        AND NOT EXISTS (SELECT 1 FROM shop_dish WHERE row_version<1)),
    ('canonical_schedule_35_rows_1_closed', (SELECT count(*)=35 AND count(*) FILTER(WHERE is_closed)=1 FROM shop_schedule)),
    ('schedule_seven_days_at_least_one_open', NOT EXISTS (
        SELECT 1 FROM shop sh LEFT JOIN shop_schedule sc USING(shop_id)
        GROUP BY sh.shop_id HAVING count(sc.day_of_week)<>7 OR count(*) FILTER(WHERE NOT sc.is_closed)=0)),
    ('sunday_closed_for_bep_hat', EXISTS (
        SELECT 1 FROM shop sh JOIN shop_schedule sc USING(shop_id)
        WHERE sh.name='Bếp Hạt Và Rau' AND sc.day_of_week=7 AND sc.is_closed AND sc.open_time IS NULL AND sc.close_time IS NULL)),
    ('two_current_pending_demo_requests', (SELECT count(*)=2 AND count(*) FILTER(WHERE status='pending')=2 FROM shop_submission)),
    ('pending_request_owner_and_shop_state', NOT EXISTS (
        SELECT 1 FROM shop_submission ss JOIN shop sh USING(shop_id)
        WHERE ss.submitted_by<>sh.owner_account_id OR ss.reviewed_by IS NOT NULL OR ss.reviewed_at IS NOT NULL OR ss.review_note IS NOT NULL
            OR (ss.submission_type='identity_edit' AND sh.verification_status<>'verified')
            OR (ss.submission_type IN ('registration','resubmission') AND sh.verification_status<>'pending'))),
    ('registration_snapshot_complete', EXISTS (
        SELECT 1 FROM shop_submission ss JOIN shop sh USING(shop_id)
        WHERE sh.name='Bếp Hạt Và Rau' AND ss.submission_type='registration' AND ss.before_value IS NULL
            AND valid_shop_form_snapshot(ss.after_value))),
    ('identity_request_keeps_public_name', EXISTS (
        SELECT 1 FROM shop_submission ss JOIN shop sh USING(shop_id)
        WHERE sh.name='An Nhiên Vegan' AND sh.verification_status='verified' AND ss.submission_type='identity_edit'
            AND ss.before_value=jsonb_build_object('name','An Nhiên Vegan')
            AND ss.after_value=jsonb_build_object('name','An Nhiên Vegan & Kitchen'))),
    ('no_invented_terminal_submission_history', NOT EXISTS (SELECT 1 FROM shop_submission WHERE status<>'pending')),
    ('four_admin_notifications_per_demo_request', NOT EXISTS (
        SELECT 1 FROM shop_submission ss WHERE (SELECT count(*) FROM notification n JOIN account a ON a.account_id=n.account_id JOIN role r USING(role_id)
            WHERE n.ref_type='shop' AND n.ref_id=ss.shop_id AND r.name='admin'
                AND n.metadata->>'fixture'='sprint2_20261004' AND n.metadata->>'submissionId'=ss.shop_submission_id::text)<>4)),
    ('identity_notifications_have_separate_type', (SELECT count(*)=4 FROM notification WHERE type='shop_identity_edit_pending')),
    ('public_menu_9_rows', (SELECT count(*)=9 FROM shop sh JOIN shop_dish sd USING(shop_id) JOIN dish d USING(dish_id)
        WHERE sh.verification_status='verified' AND d.status='active' AND sd.is_available)),
    ('pending_unique_index_present', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_shop_submission_pending' AND indexdef LIKE '%WHERE (status = %')),
    ('shop_submission_eleven_fields', (SELECT count(*)=11 FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_submission'))
) AS checks(check_name, passed)
ORDER BY check_name;

-- Informational counts; never expose request snapshots through a public API.
SELECT verification_status, count(*) AS shops FROM shop GROUP BY verification_status ORDER BY verification_status;
SELECT submission_type, status, count(*) AS submissions FROM shop_submission GROUP BY submission_type,status ORDER BY submission_type;
ROLLBACK;
