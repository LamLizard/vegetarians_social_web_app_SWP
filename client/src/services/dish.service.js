import { apiFetch } from './api';

// Duy's code: Lấy danh mục đang hoạt động để điền bộ chọn Dish.
export async function getDishCategories() {
  return apiFetch('/dishes/categories');
}

// Duy's code: Gửi đề xuất Dish của Member để backend tạo ở trạng thái pending.
export async function suggestDish(payload) {
  return apiFetch('/dishes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Duy's code: Đọc danh sách Dish do Member hiện tại đề xuất.
export async function getMyDishes() {
  return apiFetch('/dishes/mine');
}

// Duy's code: Gửi Dish do Admin tạo để backend kích hoạt trực tiếp.
export async function createAdminDish(payload) {
  return apiFetch('/dishes/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Duy's code: Tải hàng chờ Dish pending cho màn hình Admin.
export async function getPendingDishes() {
  return apiFetch('/dishes/admin/pending');
}

// Duy's Code: Lấy toàn bộ món đã duyệt và bị từ chối cho trang quản lý món ăn.
export async function getAdminDishes() {
  return apiFetch('/dishes/admin/all');
}

// Duy's code: Gửi quyết định duyệt/từ chối và lý do tới backend.
export async function decideDish(dishId, action, note = '') {
  return apiFetch(`/dishes/admin/${dishId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
}
