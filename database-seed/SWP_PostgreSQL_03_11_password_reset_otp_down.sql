-- Rollback cho SWP_PostgreSQL_03_11_password_reset_otp_up.sql
-- Chỉ chạy khi thật sự muốn bỏ tính năng Quên mật khẩu (mất mọi yêu cầu đang chờ).
DROP INDEX IF EXISTS idx_password_reset_otp_token;
DROP TABLE IF EXISTS password_reset_otp;
