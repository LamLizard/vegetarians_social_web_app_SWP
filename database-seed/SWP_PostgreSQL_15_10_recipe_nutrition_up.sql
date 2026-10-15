-- Khoi's code (15/10/2026): 6 chỉ số dinh dưỡng TUỲ CHỌN cho công thức, tính cho 1 người.
-- Khối "Dinh dưỡng (không bắt buộc)" ở trang Tạo công thức. Cột calories_kcal đã có sẵn từ trước.
-- PHẢI chạy file này trên Neon TRƯỚC khi chạy code mới (code ghi/đọc các cột này).
-- Chạy lại không sao (IF NOT EXISTS). Không đổi dữ liệu cũ: công thức cũ có các cột = NULL.

BEGIN;

ALTER TABLE recipe ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,1);  -- đạm (g)
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS carb_g    NUMERIC(6,1);  -- tinh bột (g)
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS fat_g     NUMERIC(6,1);  -- chất béo (g)
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS fiber_g   NUMERIC(6,1);  -- chất xơ (g)
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS sugar_g   NUMERIC(6,1);  -- đường (g)
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS sodium_mg INT;           -- natri (mg)

-- Không âm, có trần (giống kiểm tra ở server/src/utils/recipeInput.js)
ALTER TABLE recipe DROP CONSTRAINT IF EXISTS ck_recipe_nutrition_range;
ALTER TABLE recipe ADD CONSTRAINT ck_recipe_nutrition_range CHECK (
  (protein_g IS NULL OR protein_g BETWEEN 0 AND 1000) AND
  (carb_g    IS NULL OR carb_g    BETWEEN 0 AND 1000) AND
  (fat_g     IS NULL OR fat_g     BETWEEN 0 AND 1000) AND
  (fiber_g   IS NULL OR fiber_g   BETWEEN 0 AND 1000) AND
  (sugar_g   IS NULL OR sugar_g   BETWEEN 0 AND 1000) AND
  (sodium_mg IS NULL OR sodium_mg BETWEEN 0 AND 20000)
);

COMMIT;

-- Kiểm tra: phải ra 6 dòng
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'recipe' AND column_name IN ('protein_g','carb_g','fat_g','fiber_g','sugar_g','sodium_mg')
ORDER BY column_name;
