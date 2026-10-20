-- Khoi's code (15/10/2026): HOÀN TÁC thông báo công thức. Bình thường KHÔNG chạy.
-- Chỉ xoá các thông báo công thức đã tạo. PostgreSQL không có lệnh bỏ 1 giá trị enum
-- (phải tạo lại cả kiểu enum), nên 3 giá trị recipe_approved, recipe_rejected, 'recipe' vẫn còn —
-- để lại không ảnh hưởng gì vì không còn dòng nào dùng.

BEGIN;
DELETE FROM notification WHERE type::text IN ('recipe_approved', 'recipe_rejected');
COMMIT;
