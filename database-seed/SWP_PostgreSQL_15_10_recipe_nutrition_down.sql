-- Khoi's code (15/10/2026): HOÀN TÁC 6 cột dinh dưỡng. Bình thường KHÔNG chạy.
-- Mất luôn số liệu dinh dưỡng đã nhập. Chạy xong thì code mới sẽ lỗi khi gửi/xem công thức → phải lùi code theo.
BEGIN;
ALTER TABLE recipe DROP CONSTRAINT IF EXISTS ck_recipe_nutrition_range;
ALTER TABLE recipe
  DROP COLUMN IF EXISTS protein_g,
  DROP COLUMN IF EXISTS carb_g,
  DROP COLUMN IF EXISTS fat_g,
  DROP COLUMN IF EXISTS fiber_g,
  DROP COLUMN IF EXISTS sugar_g,
  DROP COLUMN IF EXISTS sodium_mg;
COMMIT;
