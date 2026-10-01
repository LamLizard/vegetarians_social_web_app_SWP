import { apiFetch } from './api'; /* Duy's code: Dùng wrapper API hiện có của client. */

export async function getProfile() {
  return apiFetch('/users/me'); /* Duy's code: API_BASE_URL đã tự thêm tiền tố /api. */
}

export async function updateProfile(payload) {
  return apiFetch('/users/me', { /* Duy's code: Gửi cập nhật hồ sơ qua cùng wrapper API. */
    method: 'PUT', /* Duy's code: Giữ phương thức cập nhật hồ sơ hiện có. */
    body: JSON.stringify(payload), /* Duy's code: Gửi dữ liệu hồ sơ dưới dạng JSON. */
  }); /* Duy's code: Kết thúc yêu cầu cập nhật hồ sơ. */
}
