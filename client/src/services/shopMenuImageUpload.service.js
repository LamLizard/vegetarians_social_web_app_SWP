// Upload ảnh menu riêng: signature được kiểm tra quyền quản lý menu, file gửi trực tiếp tới provider.
import { apiFetch } from './api';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

async function upload(file, { signal, onProgress } = {}) {
  if (!file || !TYPES.has(file.type) || !file.size || file.size > MAX_BYTES) throw new Error('Chọn ảnh JPG, PNG hoặc WEBP, tối đa 5 MB.');
  const signed = await apiFetch('/shops/my-shop/menu/image-upload/signature', { method: 'POST', body: '{}', signal });
  let target;
  try { target = new URL(signed?.uploadUrl); } catch { throw new Error('Thông tin tải ảnh chưa hợp lệ.'); }
  if (target.protocol !== 'https:' || target.hostname !== 'api.cloudinary.com'
    || !/^\/v1_1\/[a-z0-9][a-z0-9_-]*\/image\/upload$/.test(target.pathname)
    || target.username || target.password || target.port || target.search || target.hash
    || typeof signed.apiKey !== 'string' || !signed.apiKey || typeof signed.signature !== 'string'
    || !/^[a-f0-9]{64}$/.test(signed.signature)
    || !signed.params || typeof signed.params !== 'object' || Array.isArray(signed.params)
    || typeof signed.params.public_id !== 'string') throw new Error('Thông tin ký tải ảnh không hợp lệ.');
  const body = new FormData();
  Object.entries(signed.params).forEach(([key, value]) => body.append(key, String(value)));
  body.append('api_key', signed.apiKey); body.append('signature', signed.signature); body.append('file', file);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) abort.abort();
  const timer = window.setTimeout(cancel, 120000);
  try {
    onProgress?.(0);
    // fetch provider riêng; không gửi token/session của app sang Cloudinary.
    const response = await fetch(target.href, { method: 'POST', body, signal: abort.signal, redirect: 'error', credentials: 'omit' });
    let image;
    try { image = await response.json(); } catch { throw new Error('Dịch vụ ảnh trả dữ liệu không hợp lệ.'); }
    if (!response.ok) throw new Error('Tải ảnh không thành công. Vui lòng thử lại.');
    let url;
    try { url = new URL(image.secure_url); } catch { throw new Error('Chưa nhận được đường dẫn ảnh.'); }
    const cloud = target.pathname.split('/')[2];
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com'
      || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== `/${cloud}/image/upload/v${image.version}/${signed.params.public_id}.${image.format}`
      || image.public_id !== signed.params.public_id || image.resource_type !== 'image' || image.type !== 'upload'
      || !['jpg', 'png', 'webp'].includes(image.format)
      || !Number.isSafeInteger(image.version) || image.version < 1
      || !Number.isSafeInteger(image.bytes) || image.bytes < 1 || image.bytes > MAX_BYTES) throw new Error('Ảnh trả về không khớp lần tải hoặc vượt 5 MB.');
    onProgress?.(100);
    return url.href;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.name === 'AbortError') throw new Error('Tải ảnh quá lâu. Vui lòng thử lại.');
    if (error instanceof TypeError) throw new Error('Chưa kết nối được dịch vụ tải ảnh. Vui lòng thử lại.');
    throw error;
  } finally { window.clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

export default { upload };
