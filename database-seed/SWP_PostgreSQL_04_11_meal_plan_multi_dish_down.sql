-- =====================================================================
-- 04/11/2026 · GỠ SWP_PostgreSQL_04_11_meal_plan_multi_dish_up.sql
-- ⚠ Trước khi gắn lại UNIQUE (meal_plan_id, meal_slot) phải xoá bớt món trùng bữa:
--   script giữ lại item_id nhỏ nhất của mỗi (meal_plan_id, meal_slot), xoá phần còn lại.
--   → MẤT các món thêm sau (món thứ 2, 3 của mỗi bữa). Chỉ chạy khi thật sự muốn quay lại.
-- Sau khi gỡ, server/UI bản mới (nhiều món mỗi bữa) sẽ lỗi → phải quay code về bản trước.
-- =====================================================================
BEGIN;

DELETE FROM public.meal_plan_item doomed
USING public.meal_plan_item keeper
WHERE doomed.meal_plan_id = keeper.meal_plan_id
  AND doomed.meal_slot = keeper.meal_slot
  AND doomed.item_id > keeper.item_id;

ALTER TABLE public.meal_plan_item DROP CONSTRAINT IF EXISTS uq_meal_plan_item_slot_recipe;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_meal_plan_item_slot'
      AND conrelid = 'public.meal_plan_item'::regclass
  ) THEN
    ALTER TABLE public.meal_plan_item
      ADD CONSTRAINT uq_meal_plan_item_slot UNIQUE (meal_plan_id, meal_slot);
  END IF;
END $$;

ALTER TABLE public.meal_plan DROP CONSTRAINT IF EXISTS chk_meal_plan_household_size;
ALTER TABLE public.meal_plan DROP COLUMN IF EXISTS person_targets;
ALTER TABLE public.meal_plan DROP COLUMN IF EXISTS household_size;

COMMIT;
