-- =====================================================================
-- Khoi's code (20/10/2026) · GỠ SWP_PostgreSQL_20_10_recipe_like_up.sql
-- ⚠ Xoá HẾT lượt thích và giờ duyệt công thức. Chỉ chạy khi thật sự muốn quay lại.
-- Sau khi gỡ, server bản mới sẽ lỗi ở trang Công thức → phải quay code về bản trước.
-- =====================================================================
BEGIN;
DROP TABLE IF EXISTS recipe_like;
ALTER TABLE recipe DROP COLUMN IF EXISTS moderated_at;
COMMIT;
