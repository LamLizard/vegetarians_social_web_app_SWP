import { apiFetch, ApiError, AUTH_TOKEN_KEY } from './api';

const ROOT = '/chatbot';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

async function streamMessage(input, { signal, onDelta, onUnauthorized } = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${ROOT}/messages/stream`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  if (!response.ok) {
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    const error = new ApiError(payload?.message || 'Không thể gửi câu hỏi lúc này.', response.status, payload);
    error.notReserved = [400, 401, 403, 413, 415, 429].includes(response.status)
      || ['SESSION_EXPIRED', 'CHATBOT_DISABLED', 'CONFIG_UNAVAILABLE'].includes(payload?.code);
    throw error;
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ApiError('Không thể nhận câu trả lời.', response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let result;
  try {
    while (!result) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 262144) throw new Error('Không thể nhận câu trả lời.');
      let boundary;
      while (!result && (boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r\n|\r|\n/);
        const name = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        if (!name && !data) continue;
        if (!data) throw new Error('Không thể nhận câu trả lời.');
        const payload = JSON.parse(data);
        if (name === 'delta' && typeof payload.text === 'string') onDelta?.(payload.text);
        else if (name === 'done' && payload.session && typeof payload.limited === 'boolean') result = payload;
        else if (name === 'error') throw new ApiError(payload.message || 'Trợ lý đang gặp trục trặc.', 503, payload);
        else throw new Error('Không thể nhận câu trả lời.');
      }
      if (done && !result) throw new Error('Kết nối bị gián đoạn khi nhận câu trả lời.');
    }
    return result;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

const chatbotService = {
  getAvailability({ signal } = {}) {
    return apiFetch(`${ROOT}/availability`, { signal, cache: 'no-store' });
  },

  verifySession({ token, deviceId }, { signal } = {}) {
    return apiFetch(`${ROOT}/session/verify`, {
      method: 'POST', body: JSON.stringify({ token, deviceId }), signal, cache: 'no-store',
    });
  },

  getQuota({ signal } = {}) {
    return apiFetch(`${ROOT}/quota`, { signal });
  },

  async getRequestState({ operationId, deviceId }, { signal, onUnauthorized } = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${ROOT}/requests/status`, {
      method: 'POST', headers, body: JSON.stringify({ operationId, deviceId }), signal, cache: 'no-store',
    });
    if (response.status === 401) onUnauthorized?.(token);
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) throw new ApiError(payload?.message || 'Không thể kiểm tra lượt trước.', response.status, payload);
    return payload;
  },

  streamMessage,

  sendMessage({ operationId, text, history, deviceId, sessionToken }, { signal } = {}) {
    return apiFetch(`${ROOT}/messages`, {
      method: 'POST',
      body: JSON.stringify({ operationId, text, history, deviceId, sessionToken }),
      signal,
    });
  },
};

export default chatbotService;
