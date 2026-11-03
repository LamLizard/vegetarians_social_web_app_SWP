// Các hàm auth gọi API: register() · login() · getMe() và luồng Quên mật khẩu.
// Đổi mật khẩu khi đã đăng nhập thuộc module Hồ sơ (user.*).
import { apiFetch } from './api';

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

const authService = {
  register(payload) {
    return apiFetch('/auth/register', json(payload));
  },

  verifyRegisterOtp(details) {
    return apiFetch('/auth/register/verify', json(details));
  },

  resendRegisterOtp(email) {
    return apiFetch('/auth/register/resend', json({ email }));
  },

  // ── Quên mật khẩu: email → OTP → mật khẩu mới ──
  /** Bước 1: gửi OTP. Server trả 404 "Email chưa được đăng ký." nếu email không có trong DB. */
  forgotPassword(email) {
    return apiFetch('/auth/forgot-password', json({ email }));
  },

  /** Bước 2: xác minh OTP → nhận resetToken để đặt mật khẩu mới */
  verifyResetOtp(details) {
    return apiFetch('/auth/forgot-password/verify', json(details));
  },

  resendResetOtp(email) {
    return apiFetch('/auth/forgot-password/resend', json({ email }));
  },

  /** Bước 3: đặt mật khẩu mới. Thành công → server trả token + user (đăng nhập luôn). */
  resetPassword(details) {
    return apiFetch('/auth/forgot-password/reset', json(details));
  },

  login(payload) {
    return apiFetch('/auth/login', json(payload));
  },

  getMe() {
    return apiFetch('/auth/me');
  },

};

export default authService;
