import { apiFetch } from './api';

const ROOT = '/admin/ai-config';

export function getAIConfig({ signal } = {}) {
  return apiFetch(ROOT, { signal, cache: 'no-store' });
}

export function updateAIConfig(config, { signal } = {}) {
  return apiFetch(ROOT, { method: 'PUT', body: JSON.stringify(config), signal });
}
