import { apiFetch, ApiError, AUTH_TOKEN_KEY } from './api';

const ROOT = '/chatbot';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

async function streamMessage(input, { signal, onDelta, onUnauthorized, onResult } = {}, discovery = false) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${ROOT}/${discovery ? 'discovery' : 'messages'}/stream`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  if (!response.ok) {
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    const error = new ApiError(payload?.message || 'Không thể gửi câu hỏi lúc này.', response.status, payload);
    error.notReserved = !discovery && ([400, 401, 403, 413, 415, 429].includes(response.status)
      || ['SESSION_EXPIRED', 'CHATBOT_DISABLED', 'CONFIG_UNAVAILABLE'].includes(payload?.code));
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
        else if (discovery && name === 'result' && ['post', 'recipe'].includes(payload?.kind) && payload.item) onResult?.(payload);
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

// One fetch per user action: a lost response must never trigger an automatic retry.
async function streamSimpleTurn(input, { signal, onAccepted, onDelta, onResult, onUnauthorized } = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${ROOT}/turns/stream`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new ApiError(payload?.message || 'Không thể gửi câu hỏi lúc này.', response.status, payload);
    error.rejectedBeforeAdmission = [400, 413, 415].includes(response.status)
      || payload?.code === 'CHATBOT_DISABLED';
    throw error;
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ApiError('Không thể nhận câu trả lời.', response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let result;
  let accepted = false;
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
        if (name === 'accepted' && !accepted && payload.session) { accepted = true; onAccepted?.(payload); }
        else if (name === 'delta' && accepted && typeof payload.text === 'string') onDelta?.(payload.text);
        else if (name === 'result' && accepted && payload.kind === 'post' && payload.item) onResult?.(payload);
        else if (name === 'done' && accepted && payload.session && typeof payload.limited === 'boolean') result = payload;
        else if (name === 'error') throw new ApiError(payload.message || 'Trợ lý đang gặp trục trặc.', 503, payload);
        else throw new Error('Không thể nhận câu trả lời.');
      }
      if (done && !result) throw new Error('Kết nối bị gián đoạn; chưa xác định được kết quả.');
    }
    return result;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

function discoveryPayload(input) {
  return { text: input.text.trim(), history: input.history.map(({ sender, content }) => ({ sender, content })),
    sessionToken: input.sessionToken ?? null, flowToken: input.flowToken ?? null,
    flowSubject: input.flowSubject ?? null };
}

async function discoveryPayloadHash(input) {
  if (!globalThis.crypto?.subtle) throw new Error('Không thể tạo mã yêu cầu an toàn.');
  const bytes = new TextEncoder().encode(JSON.stringify(discoveryPayload(input)));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function v2Post(path, input, { signal, onUnauthorized } = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${ROOT}${path}`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.message || 'Không thể kiểm tra yêu cầu.', response.status, payload);
  if (!payload) throw new Error('Không thể xác định trạng thái yêu cầu.');
  return payload;
}

// Poll only the existing operation; this never sends the original question again.
async function checkRequestFor30s(input, { signal, onUnauthorized, onState } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let lastState = 'unknown';
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const deadline = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
  try {
    while (!controller.signal.aborted) {
      try {
        const response = await chatbotService.getRequestState(input, {
          signal: controller.signal, onUnauthorized,
        });
        if (controller.signal.aborted) break;
        lastState = ['success', 'failed', 'pending'].includes(response?.state) ? response.state : 'unknown';
        onState?.(lastState);
        if (lastState === 'success' || lastState === 'failed') return { state: lastState, timedOut: false };
      } catch (error) {
        if (controller.signal.aborted) break;
        if (error instanceof ApiError && [400, 401, 403].includes(error.status)) throw error;
        lastState = 'unknown';
        onState?.(lastState);
      }
      await new Promise((resolve) => {
        const finish = () => { window.clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
        const timer = window.setTimeout(finish, 1500);
        controller.signal.addEventListener('abort', finish, { once: true });
        if (controller.signal.aborted) finish();
      });
    }
    if (signal?.aborted) throw new DOMException('Đã hủy kiểm tra.', 'AbortError');
    return { state: lastState, timedOut };
  } finally {
    window.clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}

// Recovery may replay prepare with the same ID and digest, never the turn itself.
async function checkDiscoveryFor30s(input, { signal, onUnauthorized, onReceipt } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let receipt = input.receipt;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const deadline = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
  try {
    while (!controller.signal.aborted) {
      try {
        if (!receipt) {
          const prepared = await chatbotService.prepareTurn({ operationId: input.operationId,
            ...(input.deviceId ? { deviceId: input.deviceId } : {}), kind: 'turn', payloadHash: input.payloadHash,
            ...(input.flowToken ? { flowToken: input.flowToken, sessionToken: input.sessionToken } : {}) },
          { signal: controller.signal, onUnauthorized });
          if (typeof prepared.receipt !== 'string') throw new Error('INVALID_RECEIPT');
          await onReceipt?.(prepared.receipt);
          receipt = prepared.receipt;
        }
        const response = await chatbotService.getDiscoveryState({ operationId: input.operationId, receipt,
          ...(input.deviceId ? { deviceId: input.deviceId } : {}) }, { signal: controller.signal, onUnauthorized });
        if (controller.signal.aborted) break;
        if (['success', 'found', 'empty', 'failed', 'cancelled', 'login_required', 'clarify', 'expired'].includes(response?.state)) {
          return { state: response.state, receipt, timedOut: false };
        }
      } catch (error) {
        if (controller.signal.aborted) break;
        if (!receipt && error instanceof ApiError && ([400, 401, 403, 429].includes(error.status)
          || ['SESSION_EXPIRED', 'RESULT_UNAVAILABLE', 'CHATBOT_DISABLED'].includes(error.details?.code))) {
          return { state: 'not_started', timedOut: false };
        }
        if (error instanceof ApiError && [401, 403].includes(error.status)) throw error;
      }
      await new Promise((resolve) => {
        const finish = () => { window.clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
        const timer = window.setTimeout(finish, 1500);
        controller.signal.addEventListener('abort', finish, { once: true });
        if (controller.signal.aborted) finish();
      });
    }
    if (signal?.aborted) throw new DOMException('Đã hủy kiểm tra.', 'AbortError');
    return { state: 'unknown', receipt, timedOut };
  } finally {
    window.clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
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

  verifySimpleSession({ token, deviceId }, { signal } = {}) {
    return apiFetch(`${ROOT}/session/simple/verify`, {
      method: 'POST', body: JSON.stringify({ token, deviceId }), signal, cache: 'no-store',
    });
  },

  getQuota({ signal } = {}) {
    return apiFetch(`${ROOT}/quota`, { signal });
  },

  getSimpleQuota({ signal } = {}) {
    return apiFetch(`${ROOT}/quota/simple`, { signal, cache: 'no-store' });
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
  streamSimpleTurn,
  discoveryPayloadHash,
  prepareTurn(input, options = {}) { return v2Post('/turns/prepare', input, options); },
  getDiscoveryState(input, options = {}) { return v2Post('/discovery/status', input, options); },
  streamDiscovery(input, options = {}) { return streamMessage(input, options, true); },
  checkRequestFor30s,
  checkDiscoveryFor30s,

  async getDiscoveryPost(id, { signal } = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${ROOT}/discovery/post/${encodeURIComponent(id)}`, {
      headers, signal, cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(payload?.message || 'Chưa thể tải bài viết.', response.status, payload);
    }
    return payload;
  },

  sendMessage({ operationId, text, history, deviceId, sessionToken }, { signal } = {}) {
    return apiFetch(`${ROOT}/messages`, {
      method: 'POST',
      body: JSON.stringify({ operationId, text, history, deviceId, sessionToken }),
      signal,
    });
  },
};

export default chatbotService;
