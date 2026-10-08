// Tùng — Sprint 2: đăng ký/nộp lại qua apiFetch hiện có, không mock persistence.
import { apiFetch } from './api';

const shopRegistrationService = {
  getContext: signal => apiFetch('/shops/registration-context', { signal }),
  register: form => apiFetch('/shops/registration', { method: 'POST', body: JSON.stringify(form) }),
  resubmit: form => apiFetch('/shops/registration', { method: 'PUT', body: JSON.stringify(form) }),
};
export default shopRegistrationService;
