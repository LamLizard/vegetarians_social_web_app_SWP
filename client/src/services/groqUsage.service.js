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

export async function getGroqModerationUsage({ date, signal } = {}) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const result = await apiFetch(`/admin/ai-config/usage/moderation${query}`, { signal, cache: 'no-store' });
  const counts = ['attempts', 'errors', 'inFlight', 'usageKnown', 'usageUnknown',
    'promptTokens', 'completionTokens', 'totalTokens'];
  const validCounts = (value) => value && counts.every((field) => Number.isSafeInteger(value[field]) && value[field] >= 0);
  if (result?.version !== 1 || typeof result.date !== 'string' || (date && result.date !== date)
      || !validCounts(result.totals) || !['unknown', 'partial', 'observed'].includes(result.coverage?.state)
      || !result.source || !Array.isArray(result.groups) || !Array.isArray(result.limits)
      || !result.groups.every((group) => group && ['comment', 'post'].includes(group.kind)
        && typeof group.model === 'string' && validCounts(group))
      || !result.limits.every((entry) => entry && entry.model === 'openai/gpt-oss-20b')) {
    throw new Error('Dữ liệu sử dụng Groq không hợp lệ.');
  }
  return result;
}
