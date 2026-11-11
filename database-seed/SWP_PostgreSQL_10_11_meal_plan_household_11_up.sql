-- =====================================================================
-- 10/11/2026 · Meal Plan: "số người ăn chung" tính cả những người KHÁC
-- Người dùng nhập số người ăn cùng (0..10, không tính bản thân) ⇒ tổng 1..11.
-- Check constraint cũ chỉ cho household_size ≤ 10 → nới lên 11.
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
-- Gỡ: SWP_PostgreSQL_10_11_meal_plan_household_11_down.sql
-- =====================================================================
BEGIN;

-- 1) Bỏ constraint cũ (1..10) bằng mọi tên đang tồn tại
ALTER TABLE public.meal_plan DROP CONSTRAINT IF EXISTS chk_meal_plan_household_size;

-- 2) Thêm lại constraint mới (1..11 = bản thân + tối đa 10 người khác)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
  ) THEN
    ALTER TABLE public.meal_plan
      ADD CONSTRAINT chk_meal_plan_household_size CHECK (household_size BETWEEN 1 AND 11);
  END IF;
END $$;

COMMIT;

-- Kiểm tra: cả 3 dòng phải là "ok"
SELECT 'chk_meal_plan_household_size' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
  ) THEN 'ok' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'giới hạn trên = 11',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
      AND pg_get_constraintdef(oid) LIKE '%11%'
  ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'không còn giới hạn 10',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
      AND pg_get_constraintdef(oid) LIKE '%<= 10%'
  ) THEN 'MISSING' ELSE 'ok' END;
