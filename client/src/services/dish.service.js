import { apiFetch } from './api';

// Duy's code: Lấy danh mục đang hoạt động để điền bộ chọn Dish.
export async function getDishCategories() {
  return apiFetch('/dishes/categories');
}

// Duy's code: Gửi Dish do Admin tạo để backend kích hoạt trực tiếp.
export async function createAdminDish(payload) {
  return apiFetch('/dishes/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAdminDishWithRecipe(payload) {
  return apiFetch('/dishes/admin/with-recipe', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Duy's Code : Lấy danh mục món cùng các công thức đã duyệt để dựng dạng nhóm.
export async function getAdminDishes() {
  return apiFetch('/dishes/admin/all');
}

export async function searchAdminDishes(query) {
  return apiFetch(`/dishes/admin/search?q=${encodeURIComponent(query)}`);
}

