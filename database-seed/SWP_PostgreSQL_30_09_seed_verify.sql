-- Read-only checks. Run after SWP_PostgreSQL_30_09_seed.sql.
-- All result rows in section 1 should have ok = true.

SELECT table_name, expected_rows, actual_rows, expected_rows=actual_rows AS ok
FROM (VALUES
('role',2::bigint,(SELECT count(*) FROM role)),
('account',54,(SELECT count(*) FROM account)),
('auth_session',5,(SELECT count(*) FROM auth_session)),
('profile',50,(SELECT count(*) FROM profile)),
('allergy',10,(SELECT count(*) FROM allergy)),
('category',10,(SELECT count(*) FROM category)),
('ingredient',32,(SELECT count(*) FROM ingredient)),
('dish',20,(SELECT count(*) FROM dish)),
('dish_category',20,(SELECT count(*) FROM dish_category)),
('recipe',15,(SELECT count(*) FROM recipe)),
('recipe_ingredient',60,(SELECT count(*) FROM recipe_ingredient)),
('post',32,(SELECT count(*) FROM post)),
('post_category',32,(SELECT count(*) FROM post_category)),
('comment',52,(SELECT count(*) FROM comment)),
('post_vote',130,(SELECT count(*) FROM post_vote)),
('report_case',17,(SELECT count(*) FROM report_case)),
('report',42,(SELECT count(*) FROM report)),
('notification',35,(SELECT count(*) FROM notification)),
('banned_keyword',8,(SELECT count(*) FROM banned_keyword)),
('admin_log',12,(SELECT count(*) FROM admin_log)),
('daily_quota',23,(SELECT count(*) FROM daily_quota)),
('meal_plan',5,(SELECT count(*) FROM meal_plan)),
('meal_plan_item',45,(SELECT count(*) FROM meal_plan_item)),
('chat_session',5,(SELECT count(*) FROM chat_session)),
('chat_message',15,(SELECT count(*) FROM chat_message)),
('shop',5,(SELECT count(*) FROM shop)),
('shop_dish',20,(SELECT count(*) FROM shop_dish))
) AS x(table_name,expected_rows,actual_rows)
ORDER BY table_name;

-- All result rows in section 2 should have ok = true.
SELECT 'exact_admin_emails' AS check_name,
       (SELECT array_agg(email ORDER BY email) FROM account a JOIN role r ON r.role_id=a.role_id WHERE r.name='admin')
       =ARRAY['duymk@greenbowl.vn','khoila@greenbowl.vn','lamdv@greenbowl.vn','tungnh@greenbowl.vn'] AS ok
UNION ALL
SELECT '50_members',(SELECT count(*) FROM account a JOIN role r ON r.role_id=a.role_id WHERE r.name='member')=50
UNION ALL
SELECT 'one_bcrypt_hash_for_every_account',
       (SELECT count(*) FROM account WHERE password_hash='$2b$10$upel7zVXgMH0Vqer9A81BuJBJy/ZVvX9dZBPrnQLK4WSManUvAjfa')=54
UNION ALL
SELECT 'all_cases_have_reports',
       NOT EXISTS (SELECT 1 FROM report_case rc WHERE NOT EXISTS (SELECT 1 FROM report r WHERE r.case_id=rc.case_id))
UNION ALL
SELECT 'report_target_and_status_match_case',
       NOT EXISTS (SELECT 1 FROM report r JOIN report_case rc ON rc.case_id=r.case_id
                   WHERE r.target_type<>rc.target_type OR r.target_id<>rc.target_id OR r.status<>rc.status)
UNION ALL
SELECT 'report_case_metadata_consistent',
       NOT EXISTS (SELECT 1 FROM report_case rc WHERE
                   (rc.status='pending' AND (rc.handled_by IS NOT NULL OR rc.handled_at IS NOT NULL OR rc.resolution_note IS NOT NULL))
                   OR (rc.status<>'pending' AND (rc.handled_by IS NULL OR rc.handled_at IS NULL OR rc.resolution_note IS NULL)))
UNION ALL
SELECT 'report_metadata_matches_case',
       NOT EXISTS (SELECT 1 FROM report r JOIN report_case rc ON rc.case_id=r.case_id
                   WHERE r.handled_by IS DISTINCT FROM rc.handled_by
                      OR r.handled_at IS DISTINCT FROM rc.handled_at
                      OR r.resolution_note IS DISTINCT FROM rc.resolution_note)
UNION ALL
SELECT 'unique_reporter_per_case',
       NOT EXISTS (SELECT 1 FROM report GROUP BY case_id,reporter_id HAVING count(*)>1)
UNION ALL
SELECT 'one_open_case_per_target',
       NOT EXISTS (SELECT 1 FROM report_case WHERE status='pending'
                   GROUP BY target_type,target_id HAVING count(*)>1)
UNION ALL
SELECT 'post_case_reopened_after_rejection',
       EXISTS (SELECT 1 FROM report_case old JOIN report_case fresh
               ON fresh.target_type=old.target_type AND fresh.target_id=old.target_id
              WHERE old.target_type='post' AND old.status='rejected'
                AND fresh.status='pending' AND fresh.created_at>old.handled_at)
UNION ALL
SELECT 'comment_case_reopened_after_rejection',
       EXISTS (SELECT 1 FROM report_case old JOIN report_case fresh
               ON fresh.target_type=old.target_type AND fresh.target_id=old.target_id
              WHERE old.target_type='comment' AND old.status='rejected'
                AND fresh.status='pending' AND fresh.created_at>old.handled_at)
UNION ALL
SELECT 'account_case_reopened_after_rejection',
       EXISTS (SELECT 1 FROM report_case old JOIN report_case fresh
               ON fresh.target_type=old.target_type AND fresh.target_id=old.target_id
              WHERE old.target_type='account' AND old.status='rejected'
                AND fresh.status='pending' AND fresh.created_at>old.handled_at)
UNION ALL
SELECT 'four_account_cases',
       (SELECT count(*) FROM report_case WHERE target_type='account')=4
UNION ALL
SELECT 'valid_polymorphic_targets',
       NOT EXISTS (SELECT 1 FROM report_case rc WHERE
                   (rc.target_type='post' AND NOT EXISTS (SELECT 1 FROM post p WHERE p.post_id=rc.target_id))
                   OR (rc.target_type='comment' AND NOT EXISTS (SELECT 1 FROM comment c WHERE c.comment_id=rc.target_id))
                   OR (rc.target_type='recipe' AND NOT EXISTS (SELECT 1 FROM recipe x WHERE x.recipe_id=rc.target_id))
                   OR (rc.target_type='account' AND NOT EXISTS (SELECT 1 FROM account a WHERE a.account_id=rc.target_id))
                   OR rc.target_type NOT IN ('post','comment','recipe','account'))
UNION ALL
SELECT 'pending_post_status_reported',
       NOT EXISTS (SELECT 1 FROM report_case rc JOIN post p ON rc.target_type='post' AND rc.target_id=p.post_id
                   WHERE rc.status='pending' AND p.status<>'reported')
UNION ALL
SELECT 'accepted_post_deleted',
       NOT EXISTS (SELECT 1 FROM report_case rc JOIN post p ON rc.target_type='post' AND rc.target_id=p.post_id
                   WHERE rc.status='accepted' AND p.status<>'deleted')
UNION ALL
SELECT 'accepted_comment_hidden',
       NOT EXISTS (SELECT 1 FROM report_case rc JOIN comment c ON rc.target_type='comment' AND rc.target_id=c.comment_id
                   WHERE rc.status='accepted' AND c.status NOT IN ('hidden','deleted'))
UNION ALL
SELECT 'pending_account_reported',
       NOT EXISTS (SELECT 1 FROM report_case rc JOIN account a ON rc.target_type='account' AND rc.target_id=a.account_id
                   WHERE rc.status='pending' AND a.status<>'reported')
UNION ALL
SELECT 'accepted_account_locked',
       NOT EXISTS (SELECT 1 FROM report_case rc JOIN account a ON rc.target_type='account' AND rc.target_id=a.account_id
                   WHERE rc.status='accepted' AND a.status<>'locked')
UNION ALL
SELECT 'post_counters_match',
       NOT EXISTS (SELECT 1 FROM post p WHERE
                   p.vote_count<>(SELECT count(*) FROM post_vote v WHERE v.post_id=p.post_id)
                   OR p.comment_count<>(SELECT count(*) FROM comment c WHERE c.post_id=p.post_id AND c.status<>'deleted'))
UNION ALL
SELECT 'recipe_ingredients_plant_based',
       NOT EXISTS (SELECT 1 FROM recipe_ingredient ri JOIN ingredient i ON i.ingredient_id=ri.ingredient_id
                   WHERE i.is_animal_derived)
UNION ALL
SELECT 'shop_and_plan_dishes_active',
       NOT EXISTS (SELECT 1 FROM shop_dish sd JOIN dish d ON d.dish_id=sd.dish_id WHERE d.status<>'active')
       AND NOT EXISTS (SELECT 1 FROM meal_plan_item mi JOIN dish d ON d.dish_id=mi.dish_id WHERE d.status<>'active')
ORDER BY check_name;

-- Admin list sample: newest report in each case first.
SELECT rc.case_id,rc.target_type,rc.target_id,rc.status,
       count(r.report_id) AS report_count,min(r.created_at) AS first_report_at,
       max(r.created_at) AS latest_report_at,
       CASE WHEN rc.target_type='post' THEN p.title
            WHEN rc.target_type='comment' THEN left(c.content,120)
            WHEN rc.target_type='account' THEN a.full_name||' ('||a.email||')'
            WHEN rc.target_type='recipe' THEN x.title END AS target_preview
FROM report_case rc JOIN report r ON r.case_id=rc.case_id
LEFT JOIN post p ON rc.target_type='post' AND p.post_id=rc.target_id
LEFT JOIN comment c ON rc.target_type='comment' AND c.comment_id=rc.target_id
LEFT JOIN account a ON rc.target_type='account' AND a.account_id=rc.target_id
LEFT JOIN recipe x ON rc.target_type='recipe' AND x.recipe_id=rc.target_id
GROUP BY rc.case_id,rc.target_type,rc.target_id,rc.status,p.title,c.content,a.full_name,a.email,x.title
ORDER BY latest_report_at DESC,rc.case_id DESC;
