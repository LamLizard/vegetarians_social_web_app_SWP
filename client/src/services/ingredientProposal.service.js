import { apiFetch } from './api';

// Duy's Code : Service gửi đề cử từ hồ sơ và quản lý danh sách duyệt nguyên liệu Admin.
export async function submitIngredientProposal(name) {
  return apiFetch('/ingredient-proposals', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function getPendingIngredientProposals() {
  const { items } = await apiFetch('/ingredient-proposals/admin/pending');
  return items;
}

export async function decideIngredientProposal(name, action, { note = '', ...classification } = {}) {
  return apiFetch('/ingredient-proposals/admin/decision', {
    method: 'POST', body: JSON.stringify({ name, action, note, ...classification }),
  });
}
