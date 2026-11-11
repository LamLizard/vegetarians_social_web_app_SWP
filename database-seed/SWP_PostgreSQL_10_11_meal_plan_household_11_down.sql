-- =====================================================================
-- 10/11/2026 · Gỡ migration "số người ăn chung 1..11"
-- QUAN TRỌNG:
--   · Đưa constraint về lại 1..10 → MỌI thực đơn đang có household_size = 11
--     sẽ bị xoá hay không? Không: ALTER TABLE ... ADD CONSTRAINT sẽ QUÉT bảng và
--     THẤT BẠI nếu còn dòng vi phạm. Phải hạ các dòng đó trước hoặc xoá chúng.
--   · Phải rollback code trước (client MAX_HOUSEHOLD = 10, controller 10) nếu không
--     người dùng vẫn chọn được 11 người và API sẽ trả 500 do vi phạm constraint.
-- =====================================================================
BEGIN;

ALTER TABLE public.meal_plan DROP CONSTRAINT IF EXISTS chk_meal_plan_household_size;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
  ) THEN
    ALTER TABLE public.meal_plan
      ADD CONSTRAINT chk_meal_plan_household_size CHECK (household_size BETWEEN 1 AND 10);
  END IF;
END $$;

COMMIT;

SELECT 'chk_meal_plan_household_size (1..10)' AS item,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_meal_plan_household_size'
      AND conrelid = 'public.meal_plan'::regclass
      AND pg_get_constraintdef(oid) LIKE '%<= 10%'
  ) THEN 'ok' ELSE 'MISSING' END AS result;
