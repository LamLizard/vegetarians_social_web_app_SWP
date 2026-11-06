import { apiFetch } from './api';

const fields = ['attempts', 'errors', 'inFlight', 'usageKnown', 'usageUnknown',
  'promptTokens', 'completionTokens', 'totalTokens'];

function validCounts(value) {
  return value && fields.every((field) => Number.isSafeInteger(value[field]) && value[field] >= 0);
}

export async function getDeepseekUsage({ date, signal } = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const result = await apiFetch(`/admin/ai-config/usage/deepseek${query}`, { signal, cache: 'no-store' });
  if (result?.version !== 1 || result.provider !== 'deepseek' || typeof result.model !== 'string'
      || typeof result.date !== 'string' || (date && result.date !== date)
      || typeof result.generatedAt !== 'string' || !result.source
      || !['unknown', 'partial', 'observed'].includes(result.coverage?.state)
      || !validCounts(result.totals) || !Array.isArray(result.groups)
      || !result.groups.every((group) => ['classifier', 'answer', 'verifier'].includes(group.kind) && validCounts(group))) { // Khoi's code (07/11/2026): thêm loại gọi verifier
    throw new Error('Dữ liệu sử dụng DeepSeek không hợp lệ.');
  }
  return result;
}
