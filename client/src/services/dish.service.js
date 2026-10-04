import { apiFetch } from './api';

export async function getDishCategories() {
  return apiFetch('/dishes/categories');
}

export async function suggestDish(payload) {
  return apiFetch('/dishes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyDishes() {
  return apiFetch('/dishes/mine');
}

export async function createAdminDish(payload) {
  return apiFetch('/dishes/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPendingDishes() {
  return apiFetch('/dishes/admin/pending');
}

export async function decideDish(dishId, action, note = '') {
  return apiFetch(`/dishes/admin/${dishId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
}
