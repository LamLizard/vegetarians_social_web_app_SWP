// Biến môi trường frontend chỉ chứa URL công khai, không chứa JWT_SECRET.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const tokenStorageKey = 'adminAccessToken';

export function getAdminAccessToken() {
  return window.sessionStorage.getItem(tokenStorageKey)?.trim() || '';
}
export function saveAdminAccessToken(token) {
  // Đây là giải pháp local tạm thời, sẽ tích hợp Auth chung khi Login hoàn tất.
  window.sessionStorage.setItem(tokenStorageKey, token.trim());
}
export function clearAdminAccessToken() {
  window.sessionStorage.removeItem(tokenStorageKey);
}
function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

// Các component không gọi fetch trực tiếp. Mọi request đi qua service.
async function requestAdminApi(path, { method = 'GET', body, signal } = {}) {
  const token = getAdminAccessToken();
  if (!token) {
    throw createServiceError('Chưa có phiên Admin. Vui lòng cung cấp token đăng nhập.', 401, 'ADMIN_TOKEN_REQUIRED');
  }
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  const options = { method, headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  let responseText;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, options);
    responseText = await response.text();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw createServiceError('Không kết nối được máy chủ. Kiểm tra backend và mạng rồi thử lại.', 0, 'NETWORK_ERROR');
  }
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw createServiceError('Máy chủ trả về dữ liệu không đúng định dạng JSON.', response.status, 'INVALID_SERVER_RESPONSE');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createServiceError('Dữ liệu trả về không hợp lệ.', response.status, 'INVALID_SERVER_RESPONSE');
  }
  if (!response.ok || result.success !== true) {
    throw createServiceError(result.message || 'Không thực hiện được yêu cầu.', response.status, result.error?.code || 'API_ERROR');
  }
  return result;
}

export async function getShopsForVerification({ verificationStatus = 'pending', search = '', page = 1, limit = 10, signal } = {}) {
  const parameters = new URLSearchParams({ verificationStatus, search, page: String(page), limit: String(limit) });
  const result = await requestAdminApi(`/admin/shops?${parameters}`, { signal });
  if (!Array.isArray(result.data) || !result.pagination || !Number.isInteger(result.pagination.totalPages)) throw createServiceError('Dữ liệu danh sách quán không hợp lệ.', 200, 'INVALID_SERVER_RESPONSE');
  return { shops: result.data, pagination: result.pagination };
}
export async function getShopById(shopId, { signal } = {}) {
  const result = await requestAdminApi(`/admin/shops/${encodeURIComponent(String(shopId))}`, { signal });
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw createServiceError('Dữ liệu chi tiết quán không hợp lệ.', 200, 'INVALID_SERVER_RESPONSE');
  return result.data;
}
export async function updateShopVerification({ shopId, verificationStatus, verificationNote = '' }) {
  const result = await requestAdminApi(`/admin/shops/${encodeURIComponent(String(shopId))}/verification`, {
    method: 'PATCH', body: { verificationStatus, verificationNote },
  });
  return { shop: result.data, message: result.message };
}
