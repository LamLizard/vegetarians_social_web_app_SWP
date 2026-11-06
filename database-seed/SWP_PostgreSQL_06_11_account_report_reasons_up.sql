-- 06/11/2026 · Lý do báo cáo tài khoản
-- Thêm mã lý do riêng để phân biệt report tài khoản với report bài viết/bình luận.
-- Chạy một lần trên database đang dùng; chạy lại an toàn.
-- Không bọc trong BEGIN/COMMIT: PostgreSQL không cho dùng enum value mới
-- trong cùng transaction mà enum đó được mở rộng.

ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_spam';
ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_avatar_inappropriate';
ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_impersonation';
ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_harassment';
ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_fraud';
ALTER TYPE public.report_reason_code_enum ADD VALUE IF NOT EXISTS 'account_inappropriate_content';
