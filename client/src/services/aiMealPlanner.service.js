import { ApiError, AUTH_TOKEN_KEY } from './api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

// A lost response is an unknown outcome: never resend a mutation automatically.
// The parent checks the captured token before handling an unauthorized response.
async function postOnce(path, input, { signal, onUnauthorized } = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) throw new ApiError(payload?.message || 'Không thể xử lý thực đơn lúc này.', response.status, payload);
  if (!payload) throw new ApiError('Không thể xác định kết quả yêu cầu.', response.status);
  return payload;
}

export function previewAIWeek(input, options = {}) {
  return postOnce('/ai-meal-planner/preview', input, options);
}

export function confirmAIWeek(input, options = {}) {
  return postOnce('/ai-meal-planner/confirm', input, options);
}

export async function plannerPayloadHash(weekStart, continueWithoutProfile) {
  if (!globalThis.crypto?.subtle) throw new Error('Không thể tạo mã yêu cầu an toàn.');
  const payload = { kind: 'meal_preview', weekStart, continueWithoutProfile };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Check the same operation only; an absent record is not evidence of failure.
export async function checkConfirmFor30s(operationId, { signal, onUnauthorized } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const deadline = window.setTimeout(() => controller.abort(), 30000);
  try {
    while (!controller.signal.aborted) {
      try {
        const result = await confirmAIWeek({ operationId, statusOnly: true }, {
          signal: controller.signal, onUnauthorized,
        });
        if (controller.signal.aborted) break;
        if (result?.state === 'saved') return { state: 'saved' };
      } catch (error) {
        if (controller.signal.aborted) break;
        if (error instanceof ApiError && [400, 401, 403].includes(error.status)) throw error;
      }
      await new Promise((resolve) => {
        const finish = () => { window.clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
        const timer = window.setTimeout(finish, 1500);
        controller.signal.addEventListener('abort', finish, { once: true });
        if (controller.signal.aborted) finish();
      });
    }
    if (signal?.aborted) throw new DOMException('Đã hủy kiểm tra.', 'AbortError');
    return { state: 'unknown' };
  } finally {
    window.clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}
