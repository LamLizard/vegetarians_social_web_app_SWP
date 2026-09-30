// fetch wrapper: baseURL + tự gắn token + bắt 401
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
export const AUTH_TOKEN_KEY = 'auth_token';
const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ. Có thể máy chủ đang khởi động — bạn thử lại sau vài giây nhé.';

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw new ApiError(NETWORK_ERROR_MESSAGE, 0, error);
    }
  }
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (response.status === 401) unauthorizedHandler?.();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message
      ? payload.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export function apiRequest(path, options = {}) {
  const normalizedPath = API_BASE_URL.endsWith('/api')
    ? path.replace(/^\/api(?=\/|$)/, '')
    : path;
  return apiFetch(normalizedPath, options);
}