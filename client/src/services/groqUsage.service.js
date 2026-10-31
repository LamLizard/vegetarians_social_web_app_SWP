import { apiFetch } from './api';

export async function getGroqUsage({ date, signal } = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const result = await apiFetch(`/admin/ai-config/usage${query}`, { signal, cache: 'no-store' });
  if (result?.version !== 1 || !result.totals || !result.coverage || !result.source
      || !Array.isArray(result.groups) || !Array.isArray(result.limits)) {
    throw new Error('Dữ liệu sử dụng Groq không hợp lệ.');
  }
  return result;
}
