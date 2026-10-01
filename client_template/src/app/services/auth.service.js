import { api } from './api';

// Các hàm gọi API đăng nhập – khớp server/src/routes/auth.routes.js

/** @returns {Promise<{token:string, user:object}>} */
export const register = ({ fullName, email, password }) =>
  api('/api/auth/register', { method: 'POST', body: { fullName, email, password } });

/** @returns {Promise<{token:string, user:object}>}  lỗi 401 = sai email/mật khẩu, 403 + locked = bị khoá */
export const login = ({ email, password, remember = true }) =>
  api('/api/auth/login', { method: 'POST', body: { email, password, remember } });

/** @returns {Promise<{user:object}>}  kiểm tra token còn sống không */
export const getMe = () => api('/api/auth/me');

export const changePassword = ({ currentPassword, newPassword }) =>
  api('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });

export const logout = () => api('/api/auth/logout', { method: 'POST' });
