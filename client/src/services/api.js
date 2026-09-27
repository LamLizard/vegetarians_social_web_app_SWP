const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function apiRequest(path, { token = sessionStorage.getItem('accessToken'), ...options } = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Hãy kiểm tra server đang chạy.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      sessionStorage.removeItem('accessToken');
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new Error(data.message || 'Yêu cầu không thành công.');
  }
  return data;
}