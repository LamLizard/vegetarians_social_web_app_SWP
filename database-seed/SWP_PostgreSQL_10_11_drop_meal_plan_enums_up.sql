-- =====================================================================
-- 10/11/2026 · Meal Plan: bỏ 2 enum không còn ai dùng
--   - meal_plan_status_enum (draft|saved|archived)  → cột meal_plan.status
--   - meal_plan_source_enum (manual|ai)             → cột meal_plan.source
--
-- Vì sao bỏ: code chỉ luôn ghi 'saved' / 'manual' và không có nhánh nào đọc
-- 2 cột này để quyết định nghiệp vụ (xem server/src/models/meal-plan.model.js).
-- UNIQUE (account_id, plan_date) cũng khiến draft/saved/archived vô nghĩa.
--
-- LƯU Ý THỨ TỰ: chạy file này SAU khi code mới (không còn INSERT status/source)
-- đã lên production. Code mới chạy được trên schema cũ, còn code cũ thì KHÔNG
-- chạy được trên schema mới (INSERT sẽ báo thiếu cột).
--
-- Dữ liệu bị mất: giá trị status='saved' và source='manual' của toàn bộ
-- meal_plan hiện có (đã sao lưu trước khi chạy, xem báo cáo).
-- Gỡ: SWP_PostgreSQL_10_11_drop_meal_plan_enums_down.sql
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
-- =====================================================================
BEGIN;

-- 1) Bỏ cột trước (type không drop được khi còn cột phụ thuộc)
ALTER TABLE public.meal_plan DROP COLUMN IF EXISTS status;
ALTER TABLE public.meal_plan DROP COLUMN IF EXISTS source;

-- 2) Bỏ type (IF EXISTS để chạy lại không lỗi)
DROP TYPE IF EXISTS public.meal_plan_status_enum;
DROP TYPE IF EXISTS public.meal_plan_source_enum;

COMMIT;

-- Kiểm tra: cả 5 dòng phải là "ok"
SELECT 'cột meal_plan.status đã bỏ' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'status'
  ) THEN 'MISSING' ELSE 'ok' END AS result
UNION ALL
SELECT 'cột meal_plan.source đã bỏ',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'source'
  ) THEN 'MISSING' ELSE 'ok' END
UNION ALL
SELECT 'type meal_plan_status_enum đã bỏ',
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_plan_status_enum')
  THEN 'MISSING' ELSE 'ok' END
UNION ALL
SELECT 'type meal_plan_source_enum đã bỏ',
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_plan_source_enum')
  THEN 'MISSING' ELSE 'ok' END
UNION ALL
SELECT 'enum còn lại của thực đơn (meal_slot_enum) vẫn nguyên',
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_slot_enum')
  THEN 'ok' ELSE 'MISSING' END;
