// Các hàm auth gọi API: register() · login() · getMe(). Đổi mật khẩu thuộc module Hồ sơ.
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

  login(payload) {
    return apiFetch('/auth/login', json(payload));
  },

  getMe() {
    return apiFetch('/auth/me');
  },

};

export default authService;