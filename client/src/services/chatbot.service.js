import { apiFetch, ApiError, AUTH_TOKEN_KEY } from './api';

const ROOT = '/chatbot';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

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

// Khoi's code (05/11/2026): chỉ hiện thẻ khi server trả đúng hình dạng dữ liệu Green Bowl.
const RESULT_ID = /^[1-9]\d{0,17}$/;
const isResultId = (value) => typeof value === 'string' && RESULT_ID.test(value);
const isOptionalNumber = (value) => value === null || value === undefined || Number.isFinite(value);
const isRecipeCard = (item) => Boolean(item) && isResultId(item.id) && typeof item.title === 'string' && Boolean(item.title.trim())
  && (item.thumbnailUrl == null || (typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.length <= 2048))
  && isOptionalNumber(item.caloriesKcal) && isOptionalNumber(item.minutes);
const isShopCard = (item) => Boolean(item) && isResultId(item.id) && typeof item.name === 'string' && Boolean(item.name.trim())
  && typeof item.statusText === 'string' && item.statusText.length <= 120 && typeof item.isOpen === 'boolean'
  && (item.address == null || (typeof item.address === 'string' && item.address.length <= 500));
const isCardList = (items, check) => Array.isArray(items) && items.length > 0 && items.length <= 3 && items.every(check);

function validResult(payload) {
  if (payload.kind === 'post') {
    // Khoi's code (05/11/2026): server trả items (tối đa 3) thay cho item đơn.
    const items = Array.isArray(payload.items) ? payload.items : (payload.item ? [payload.item] : []);
    return items.length > 0 && items.length <= 3
      && items.every((item) => item && isResultId(item.id) && typeof item.title === 'string' && Boolean(item.title.trim()))
      && (payload.search === undefined || (payload.search && typeof payload.search === 'object'
      && !Array.isArray(payload.search) && Object.keys(payload.search).length === 2
      && Object.keys(payload.search).every((key) => ['subject', 'matchKind'].includes(key))
      && typeof payload.search.subject === 'string' && payload.search.subject.trim()
      && Array.from(payload.search.subject).length <= 10000
      && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(payload.search.subject)
      && ['exact', 'near'].includes(payload.search.matchKind)));
  }
  if (payload.kind === 'recipes') return isCardList(payload.items, isRecipeCard);
  if (payload.kind === 'shops') return isCardList(payload.items, isShopCard);
  return false;
}

// Tùng: mỗi thao tác gửi chỉ fetch một lần và đối chiếu turnId trước khi cập nhật UI.
async function streamTurnV3(input, { signal, onAccepted, onDelta, onResult, onRetract, onUnauthorized } = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${ROOT}/turns/stream`, {
    method: 'POST', headers, body: JSON.stringify(input), signal, cache: 'no-store',
  });
  if (response.status === 401) onUnauthorized?.(token);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new ApiError(payload?.message || 'Chưa xác định được trạng thái lượt này.', response.status, payload);
    error.rejectedBeforeAdmission = payload?.admitted === false && payload.turnId === input.turnId;
    throw error;
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Không thể nhận câu trả lời.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let accepted = false;
  let result = null;
  try {
    while (!result) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > 262144) throw new Error('Không thể nhận câu trả lời.');
      let boundary;
      while (!result && (boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r\n|\r|\n/);
        const name = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        if (!name && !data) continue;
        const payload = JSON.parse(data);
        if (payload.turnId !== input.turnId) throw new Error('Phản hồi không thuộc lượt hiện tại.');
        if (name === 'accepted' && !accepted && payload.session && typeof payload.quotaDay === 'string') {
          accepted = true;
          onAccepted?.(payload);
        } else if (name === 'delta' && accepted && typeof payload.text === 'string'
          && (payload.purpose === undefined || payload.purpose === 'post-found')
          && (payload.searchSubject === undefined || (typeof payload.searchSubject === 'string'
            && Boolean(payload.searchSubject.trim()) && Array.from(payload.searchSubject).length <= 10000
            && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(payload.searchSubject)))) {
          onDelta?.(payload.text, payload.purpose, payload.searchSubject);
        }
        else if (name === 'result' && accepted && validResult(payload)) onResult?.(payload);
        // Khoi's code (07/11/2026): lớp duyệt không cho qua → thu hồi nội dung đã stream.
        else if (name === 'retract' && accepted && typeof payload.text === 'string'
          && payload.text.trim() && Array.from(payload.text).length <= 10000) onRetract?.(payload.text);
        else if (name === 'done' && accepted && payload.session && payload.limited === false) result = payload;
        else if (name === 'error' && accepted) throw new ApiError(payload.message || 'Trợ lý chưa hoàn tất.', 503, payload);
        else throw new Error('Phản hồi lượt không hợp lệ.');
      }
      if (chunk.done && !result) throw new Error('Kết nối bị gián đoạn; chưa xác định được kết quả.');
    }
    return result;
  } finally { void reader.cancel().catch(() => {}); }
}

const chatbotService = {
  getAvailability({ signal } = {}) {
    return apiFetch(`${ROOT}/availability`, { signal, cache: 'no-store' });
  },

  // Tùng: refresh clock trong deadline của lượt không qua wrapper có retry.
  async getAvailabilityOnce({ signal } = {}) {
    const response = await fetch(`${API_BASE_URL}${ROOT}/availability`, { signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.message || 'Chưa thể kiểm tra chatbot.', response.status, payload);
    return payload;
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

  // Khoi's code (05/11/2026): khách lấy số lượt hỏi thử từ server theo deviceId (không đếm ở localStorage).
  async getGuestQuota(deviceId, { signal } = {}) {
    const response = await fetch(`${API_BASE_URL}${ROOT}/quota/guest?deviceId=${encodeURIComponent(deviceId)}`,
      { signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.message || 'Chưa thể kiểm tra lượt hỏi thử.', response.status, payload);
    return payload;
  },

  streamSimpleTurn,
  streamTurnV3,

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

  // Tùng: trang chi tiết luôn lấy bài mới qua contract member-only.
  async getMemberPost(id, { signal } = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${ROOT}/posts/${encodeURIComponent(id)}`, {
      headers, signal, cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.message || 'Chưa thể tải bài viết.', response.status, payload);
    return payload;
  },
};

export default chatbotService;
