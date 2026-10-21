import { apiFetch } from './api';

export function getCategories() {
  return apiFetch('/admin/categories');
}

export function createCategory(name) {
  return apiFetch('/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameCategory(id, name) {
  return apiFetch(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function setCategoryStatus(id, isActive) {
  return apiFetch(`/admin/categories/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
