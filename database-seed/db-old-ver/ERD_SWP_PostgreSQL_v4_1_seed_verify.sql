-- ERD_SWP PostgreSQL v4.1 - Seed verification (read-only)
-- Run AFTER ERD_SWP_PostgreSQL_v4_1_seed.sql on Neon.

-- 1) Expected row counts
SELECT * FROM (VALUES
('account', 15::bigint, (SELECT count(*) FROM account)),
('profile', 12, (SELECT count(*) FROM profile)),
('allergy', 10, (SELECT count(*) FROM allergy)),
('category', 10, (SELECT count(*) FROM category)),
('ingredient', 80, (SELECT count(*) FROM ingredient)),
('dish', 50, (SELECT count(*) FROM dish)),
('dish_category', 50, (SELECT count(*) FROM dish_category)),
('recipe', 50, (SELECT count(*) FROM recipe)),
('recipe_ingredient', 300, (SELECT count(*) FROM recipe_ingredient)),
('post', 20, (SELECT count(*) FROM post)),
('post_category', 20, (SELECT count(*) FROM post_category)),
('comment', 50, (SELECT count(*) FROM comment)),
('post_vote', 90, (SELECT count(*) FROM post_vote)),
('report', 8, (SELECT count(*) FROM report)),
('notification', 24, (SELECT count(*) FROM notification)),
('banned_keyword', 6, (SELECT count(*) FROM banned_keyword)),
('admin_log', 12, (SELECT count(*) FROM admin_log)),
('daily_quota', 12, (SELECT count(*) FROM daily_quota)),
('meal_plan', 5, (SELECT count(*) FROM meal_plan)),
('meal_plan_item', 51, (SELECT count(*) FROM meal_plan_item)),
('chat_session', 5, (SELECT count(*) FROM chat_session)),
('chat_message', 15, (SELECT count(*) FROM chat_message)),
('shop', 5, (SELECT count(*) FROM shop)),
('shop_dish', 25, (SELECT count(*) FROM shop_dish)),
('auth_session', 0, (SELECT count(*) FROM auth_session))
) AS x(table_name, expected_rows, actual_rows)
ORDER BY table_name;

-- 2) Status distributions
SELECT 'account' AS entity, status::text, count(*) FROM account GROUP BY status
UNION ALL
SELECT 'dish', status::text, count(*) FROM dish GROUP BY status
UNION ALL
SELECT 'post', status::text, count(*) FROM post GROUP BY status
UNION ALL
SELECT 'comment', status::text, count(*) FROM comment GROUP BY status
UNION ALL
SELECT 'report', status::text, count(*) FROM report GROUP BY status
UNION ALL
SELECT 'shop_verification', verification_status::text, count(*) FROM shop GROUP BY verification_status
ORDER BY entity, status;

-- 3) Integrity checks: every row below should return zero rows

-- Recipe must have exactly 6 ingredients.
SELECT r.recipe_id, r.title, count(ri.ingredient_id) AS ingredient_count
FROM recipe r
LEFT JOIN recipe_ingredient ri ON ri.recipe_id=r.recipe_id
GROUP BY r.recipe_id, r.title
HAVING count(ri.ingredient_id) <> 6;

-- No animal-derived ingredient may be used by seeded recipes.
SELECT r.recipe_id, r.title, i.name AS animal_ingredient
FROM recipe r
JOIN recipe_ingredient ri ON ri.recipe_id=r.recipe_id
JOIN ingredient i ON i.ingredient_id=ri.ingredient_id
WHERE i.is_animal_derived = true;

-- Post counters must match relationship tables.
SELECT p.post_id, p.title, p.vote_count, count(v.account_id) AS actual_votes
FROM post p
LEFT JOIN post_vote v ON v.post_id=p.post_id
GROUP BY p.post_id, p.title, p.vote_count
HAVING p.vote_count <> count(v.account_id);

SELECT p.post_id, p.title, p.comment_count,
       count(c.comment_id) FILTER (WHERE c.status <> 'deleted') AS actual_comments
FROM post p
LEFT JOIN comment c ON c.post_id=p.post_id
GROUP BY p.post_id, p.title, p.comment_count
HAVING p.comment_count <> count(c.comment_id) FILTER (WHERE c.status <> 'deleted');

-- Polymorphic report targets must resolve to the declared type.
SELECT r.*
FROM report r
WHERE (r.target_type='post' AND NOT EXISTS (SELECT 1 FROM post p WHERE p.post_id=r.target_id))
   OR (r.target_type='comment' AND NOT EXISTS (SELECT 1 FROM comment c WHERE c.comment_id=r.target_id))
   OR (r.target_type='recipe' AND NOT EXISTS (SELECT 1 FROM recipe x WHERE x.recipe_id=r.target_id));

-- Shop and meal-plan references must only use active dishes.
SELECT sd.shop_dish_id, d.name, d.status
FROM shop_dish sd JOIN dish d ON d.dish_id=sd.dish_id
WHERE d.status <> 'active';

SELECT mpi.item_id, mpi.dish_name, d.status
FROM meal_plan_item mpi JOIN dish d ON d.dish_id=mpi.dish_id
WHERE d.status <> 'active';

-- Seed intentionally avoids duplicate shop/dish and duplicate meal slots.
SELECT shop_id, dish_id, count(*)
FROM shop_dish
GROUP BY shop_id, dish_id
HAVING count(*) > 1;

SELECT meal_plan_id, day_no, meal_slot, count(*)
FROM meal_plan_item
GROUP BY meal_plan_id, day_no, meal_slot
HAVING count(*) > 1;

-- day_no must fit parent meal-plan days_count.
SELECT mpi.item_id, mpi.day_no, mp.days_count
FROM meal_plan_item mpi
JOIN meal_plan mp ON mp.meal_plan_id=mpi.meal_plan_id
WHERE mpi.day_no < 1 OR mpi.day_no > mp.days_count;
