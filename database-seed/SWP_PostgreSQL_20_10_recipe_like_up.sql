-- =====================================================================
-- Khoi's code (20/10/2026) · Trang Công thức: lượt thích + thời điểm duyệt
-- Chạy trong Neon SQL Editor (database swp_db). Chạy lại nhiều lần vẫn an toàn.
--   1) Bảng recipe_like: mỗi tài khoản thích 1 công thức tối đa 1 lần (PK 2 cột)
--      → nút Thích, số lượt thích, "Nổi bật tuần này" (nhiều lượt thích nhất 7 ngày)
--   2) Cột recipe.moderated_at: lúc Admin duyệt / từ chối → xếp "Mới duyệt"
-- Gỡ: SWP_PostgreSQL_20_10_recipe_like_down.sql
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS recipe_like (
    recipe_id  BIGINT      NOT NULL,
    account_id BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_recipe_like PRIMARY KEY (recipe_id, account_id),
    CONSTRAINT fk_recipe_like_recipe  FOREIGN KEY (recipe_id)  REFERENCES recipe(recipe_id),
    CONSTRAINT fk_recipe_like_account FOREIGN KEY (account_id) REFERENCES account(account_id)
);

-- Đếm lượt thích 7 ngày gần nhất của từng công thức
CREATE INDEX IF NOT EXISTS idx_recipe_like_recipe_created ON recipe_like (recipe_id, created_at);
-- "Công thức tôi đã thích" / dọn dữ liệu theo tài khoản
CREATE INDEX IF NOT EXISTS idx_recipe_like_account ON recipe_like (account_id);

ALTER TABLE recipe ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Công thức đã duyệt / từ chối từ trước: chưa biết giờ duyệt → tạm lấy giờ gửi
UPDATE recipe SET moderated_at = created_at
WHERE moderated_at IS NULL AND status::text IN ('approved', 'rejected');

COMMIT;

-- Kiểm tra: 3 dòng "ok"
SELECT 'recipe_like' AS item, CASE WHEN to_regclass('public.recipe_like') IS NOT NULL THEN 'ok' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'recipe.moderated_at', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_name = 'recipe' AND column_name = 'moderated_at') THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'approved chưa có moderated_at', CASE WHEN NOT EXISTS (SELECT 1 FROM recipe
  WHERE status::text = 'approved' AND moderated_at IS NULL) THEN 'ok' ELSE 'CÒN THIẾU' END;
