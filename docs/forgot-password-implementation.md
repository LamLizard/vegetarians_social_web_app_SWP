# Quên mật khẩu (OTP qua email) — luồng & cách kiểm thử

## Mục tiêu

Người dùng quên mật khẩu tự đặt lại được mà không cần admin, dùng đúng cơ chế OTP đã có ở luồng đăng ký.

- Email **không** có trong DB → trả về **"Email chưa được đăng ký."** (404).
- Email có trong DB → gửi mail chứa **mã OTP 6 số** (hiệu lực 5 phút).
- Xác minh OTP → đặt mật khẩu mới → **cập nhật DB rồi vào thẳng trang chính** (server trả token + user như login).

## Luồng 3 bước

| Bước | Màn hình | API | Ghi chú |
|---|---|---|---|
| 1 | Form Đăng nhập → link **"Quên mật khẩu?"** → 1 ô email | `POST /api/auth/forgot-password` | 404 `Email chưa được đăng ký.` · cooldown gửi lại 60s (429) |
| 2 | Ô nhập OTP 6 số (+ "Gửi lại mã") | `POST /api/auth/forgot-password/verify` | Sai mã: còn 4→1 lần thử; hết 5 lần → 429. Đúng mã → trả `resetToken` (hạn 10 phút) |
| 3 | 2 ô mật khẩu mới (có đo độ mạnh) | `POST /api/auth/forgot-password/reset` | 8–20 ký tự, không trùng email. Thành công → `{ token, user }` → FE lưu phiên, vào trang chính |

Gửi lại mã: `POST /api/auth/forgot-password/resend` (cùng luật cooldown 60s).

## Bảng dữ liệu

`database-seed/SWP_PostgreSQL_03_11_password_reset_otp_up.sql` (rollback: `..._down.sql`).
Tách riêng khỏi `registration_otp` để 1 email vừa đăng ký dở vừa đặt lại mật khẩu không ghi đè nhau.

| Cột | Ý nghĩa |
|---|---|
| `otp_hash` | bcrypt của mã OTP (không lưu mã gốc) |
| `reset_token_hash` | sha256 của vé cấp sau khi OTP đúng — vé chỉ dùng 1 lần |
| `expires_at` / `reset_token_expires_at` | hạn OTP 5 phút / hạn vé 10 phút |
| `attempts` | số lần nhập sai (tối đa 5) |
| `last_sent_at` | mốc tính cooldown gửi lại |

## Ghi chú thiết kế

- **Không** cho đổi mật khẩu chỉ với email: bước 3 bắt buộc có `resetToken` (chỉ cấp sau khi OTP đúng).
- Dùng lại đúng `mailer.js` (Brevo → Resend → SMTP) nên chạy được trên Render free; `MAIL_FALLBACK_LOG=1` thì OTP ghi vào log máy chủ (`[auth.forgotPassword.otp-fallback] email=... otp=......`).
- Tài khoản `status = 'deleted'` coi như chưa đăng ký; `locked` / `reported` vẫn đổi được mật khẩu nhưng bị chặn vào hệ thống (giống login).

## Kiểm thử

Đã chạy end-to-end với DB Neon thật (15/15 case pass): email lạ → 404, cooldown → 429, OTP sai → còn 4 lần,
OTP đúng → `resetToken`, token rác/dùng lại → 400, mật khẩu ngắn → 400, reset → 200 + token,
login mật khẩu cũ → 401, mật khẩu mới → 200, `/auth/me` bằng token sau reset → 200.
UI: Đăng nhập → "Quên mật khẩu?" → email → OTP → mật khẩu mới → tự vào Bảng tin.
