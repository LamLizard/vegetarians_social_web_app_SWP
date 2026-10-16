import { apiFetch } from './api';

// Duy's Code : Service gửi đề cử từ hồ sơ và quản lý danh sách duyệt nguyên liệu Admin.
export async function submitIngredientProposal(name) {
  return apiFetch('/ingredient-proposals', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function getMyIngredientProposals() {
  const { items } = await apiFetch('/ingredient-proposals/mine');
  return items;
}

export async function getPendingIngredientProposals() {
  const { items } = await apiFetch('/ingredient-proposals/admin/pending');
  return items;
}

// Duy's Code: Tải Banned Keyword đang dùng từ bảng hiện có để trang Admin tra cứu.
export async function getBannedKeywords() {
  const { items } = await apiFetch('/ingredient-proposals/admin/keywords');
  return items;
}

// Duy's Code: Tải từng trang lịch sử duyệt từ admin_log.
export async function getIngredientProposalHistory(page = 1) {
  return apiFetch(`/ingredient-proposals/admin/history?page=${encodeURIComponent(page)}`);
}

export async function decideIngredientProposal(name, sourceType, action, { note = '', ...classification } = {}) {
  return apiFetch('/ingredient-proposals/admin/decision', {
    method: 'POST', body: JSON.stringify({ name, sourceType, action, note, ...classification }),
  });
}
