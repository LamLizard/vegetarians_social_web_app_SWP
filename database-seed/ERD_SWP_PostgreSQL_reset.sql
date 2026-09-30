-- DESTRUCTIVE: run only against the Vegetarian Social demo database.
-- No CASCADE: an unexpected dependency stops the reset instead of dropping it.
BEGIN;

DROP TABLE IF EXISTS shop_dish;
DROP TABLE IF EXISTS shop;
DROP TABLE IF EXISTS chat_message;
DROP TABLE IF EXISTS chat_session;
DROP TABLE IF EXISTS meal_plan_item;
DROP TABLE IF EXISTS meal_plan;
DROP TABLE IF EXISTS daily_quota;
DROP TABLE IF EXISTS admin_log;
DROP TABLE IF EXISTS banned_keyword;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS report;
DROP TABLE IF EXISTS report_case;
DROP TABLE IF EXISTS recipe_ingredient;
DROP TABLE IF EXISTS recipe;
DROP TABLE IF EXISTS dish_category;
DROP TABLE IF EXISTS dish;
DROP TABLE IF EXISTS ingredient;
DROP TABLE IF EXISTS post_vote;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS post_category;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS allergy;
DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS auth_session;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS role;

DROP FUNCTION IF EXISTS prevent_invalid_meal_plan_days_count();
DROP FUNCTION IF EXISTS validate_meal_plan_item_day_no();
DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS shop_verification_status_enum;
DROP TYPE IF EXISTS shop_status_enum;
DROP TYPE IF EXISTS chat_message_status_enum;
DROP TYPE IF EXISTS chat_sender_enum;
DROP TYPE IF EXISTS nutrition_group_enum;
DROP TYPE IF EXISTS meal_slot_enum;
DROP TYPE IF EXISTS meal_plan_status_enum;
DROP TYPE IF EXISTS meal_plan_source_enum;
DROP TYPE IF EXISTS daily_quota_subject_type_enum;
DROP TYPE IF EXISTS admin_log_target_type_enum;
DROP TYPE IF EXISTS banned_keyword_severity_enum;
DROP TYPE IF EXISTS banned_keyword_scope_enum;
DROP TYPE IF EXISTS notification_ref_type_enum;
DROP TYPE IF EXISTS notification_type_enum;
DROP TYPE IF EXISTS report_status_enum;
DROP TYPE IF EXISTS report_reason_code_enum;
DROP TYPE IF EXISTS report_target_type_enum;
DROP TYPE IF EXISTS dish_status_enum;
DROP TYPE IF EXISTS comment_status_enum;
DROP TYPE IF EXISTS post_status_enum;
DROP TYPE IF EXISTS post_type_enum;
DROP TYPE IF EXISTS health_goal_enum;
DROP TYPE IF EXISTS activity_level_enum;
DROP TYPE IF EXISTS bmi_category_enum;
DROP TYPE IF EXISTS profile_gender_enum;
DROP TYPE IF EXISTS account_status_enum;

COMMIT;
