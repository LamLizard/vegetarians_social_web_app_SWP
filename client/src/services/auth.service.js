// các hàm gọi API: register() login() getMe() changePassword()
import { apiFetch } from './api';

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

const authService = {
  register(payload) {
    return apiFetch('/auth/register', json(payload));
  },

  login(payload) {
    return apiFetch('/auth/login', json(payload));
  },

  getMe() {
    return apiFetch('/auth/me');
  },

  changePassword(payload) {
    return apiFetch('/auth/change-password', json(payload));
  },
};

export default authService;