-- Khoi's code (15/10/2026): Thông báo cho tác giả khi công thức được duyệt / bị từ chối.
-- Chạy 1 lần trên Neon SQL Editor (copy toàn bộ file → Run). Chạy lại cũng không sao (IF NOT EXISTS).
-- Code đã tự kiểm tra: chưa chạy file này thì vẫn duyệt/từ chối bình thường, chỉ là KHÔNG có thông báo.
--
-- Lưu ý PostgreSQL: giá trị enum mới chỉ dùng được SAU khi lệnh ALTER TYPE đã commit,
-- nên file này chỉ thêm enum, không INSERT thông báo nào.

ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'recipe_approved';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'recipe_rejected';
ALTER TYPE notification_ref_type_enum ADD VALUE IF NOT EXISTS 'recipe';

-- Kiểm tra: phải ra 3 dòng
SELECT t.typname, e.enumlabel
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE (t.typname = 'notification_type_enum' AND e.enumlabel IN ('recipe_approved', 'recipe_rejected'))
   OR (t.typname = 'notification_ref_type_enum' AND e.enumlabel = 'recipe')
ORDER BY 1, 2;
