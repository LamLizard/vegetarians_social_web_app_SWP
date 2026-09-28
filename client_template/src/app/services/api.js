// =====================================================================
//  fetch wrapper dùng chung cho mọi lời gọi API
//  - baseURL lấy từ client/.env (VITE_API_URL)
//  - tự gắn "Authorization: Bearer <token>" nếu đang đăng nhập
//  - bắt 401 của request có token → báo AuthContext để tự đăng xuất
// =====================================================================

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

let token = null;
let onUnauthorized = null;

/** AuthContext gọi khi đăng nhập / đăng xuất để api.js biết token hiện tại. */
export const setToken = (value) => { token = value || null; };
/** AuthContext đăng ký hàm xử lý khi phiên hết hạn (401). */
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/** Lỗi từ API: err.status (400/401/409...), err.message (tiếng Việt từ server), err.data (toàn bộ body). */
export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * api('/api/auth/me')                                   → GET
 * api('/api/auth/login', { method: 'POST', body: {...} }) → body tự JSON.stringify
 */
export async function api(path, { method = 'GET', body, headers, ...rest } = {}) {
  const sentToken = token;
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(sentToken && { Authorization: `Bearer ${sentToken}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra server đã chạy chưa.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Chỉ coi là "hết phiên" khi request CÓ gửi token (sai mật khẩu lúc login cũng trả 401 nhưng không có token)
    if (res.status === 401 && sentToken && sentToken === token) onUnauthorized?.(data);
    throw new ApiError(res.status, data.message || `Lỗi ${res.status}`, data);
  }
  return data;
}
