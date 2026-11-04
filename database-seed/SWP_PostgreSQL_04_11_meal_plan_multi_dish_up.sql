-- =====================================================================
-- 04/11/2026 · Meal Plan: 1 bữa nhiều món + thực đơn theo số người
-- Chạy trong Neon SQL Editor (database swp_db). Chạy lại nhiều lần vẫn an toàn.
--   1) Bỏ UNIQUE (meal_plan_id, meal_slot)  → một bữa được phép có nhiều món
--      Thay bằng UNIQUE (meal_plan_id, meal_slot, recipe_id) → không lặp 1 món trong cùng bữa
--   2) meal_plan.household_size  → số người ăn của thực đơn (1..10)
--   3) meal_plan.person_targets  → mảng kcal mục tiêu của từng người, vd [1600,1600,1500]
-- Gỡ: SWP_PostgreSQL_04_11_meal_plan_multi_dish_down.sql
-- =====================================================================
BEGIN;

-- 1) Cho phép nhiều item trong cùng một bữa
ALTER TABLE public.meal_plan_item DROP CONSTRAINT IF EXISTS uq_meal_plan_item_slot;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_meal_plan_item_slot_recipe'
      AND conrelid = 'public.meal_plan_item'::regclass
  ) THEN
    ALTER TABLE public.meal_plan_item
      ADD CONSTRAINT uq_meal_plan_item_slot_recipe UNIQUE (meal_plan_id, meal_slot, recipe_id);
  END IF;
END $$;

-- 2) + 3) Số người và mục tiêu calo từng người
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS household_size SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS person_targets JSONB;

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

-- Kiểm tra: 4 dòng "ok"
SELECT 'bỏ uq_meal_plan_item_slot' AS item,
  CASE WHEN NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_meal_plan_item_slot')
    THEN 'ok' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'uq_meal_plan_item_slot_recipe',
  CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_meal_plan_item_slot_recipe')
    THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'meal_plan.household_size',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'household_size')
    THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'meal_plan.person_targets',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_plan' AND column_name = 'person_targets')
    THEN 'ok' ELSE 'MISSING' END;
