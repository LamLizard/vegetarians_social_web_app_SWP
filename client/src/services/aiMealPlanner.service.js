import { apiFetch } from './api';

export function previewAIWeek(input, { signal } = {}) {
  return apiFetch('/ai-meal-planner/preview', { method: 'POST', body: JSON.stringify(input), signal });
}
