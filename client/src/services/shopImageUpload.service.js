// Tùng — Sprint 2: ký upload tại API của app, gửi file trực tiếp tới Cloudinary.
import { apiFetch } from './api';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const abortError = () => new DOMException('Đã hủy tải ảnh.', 'AbortError');

async function upload(file, { onProgress, signal } = {}) {
  if (signal?.aborted) throw abortError();
  if (!file || !IMAGE_TYPES.has(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Ảnh quán không được lớn hơn 5 MB.');
  if (!file.size) throw new Error('Ảnh đã chọn không có dữ liệu.');

  const signed = await apiFetch('/shops/image-upload/signature', { method: 'POST', body: '{}', signal });
  if (signal?.aborted) throw abortError();
  let uploadUrl;
  try { uploadUrl = new URL(signed?.uploadUrl); } catch { throw new Error('Máy chủ chưa cung cấp địa chỉ tải ảnh hợp lệ.'); }
  if (uploadUrl.protocol !== 'https:' || uploadUrl.hostname !== 'api.cloudinary.com'
    || !/^\/v1_1\/[^/]+\/image\/upload$/.test(uploadUrl.pathname)
    || uploadUrl.username || uploadUrl.password || uploadUrl.port || uploadUrl.search || uploadUrl.hash
    || !signed.apiKey || !signed.signature || !signed.params || typeof signed.params !== 'object' || Array.isArray(signed.params)) {
    throw new Error('Thông tin ký tải ảnh không hợp lệ. Vui lòng thử lại.');
  }
  const body = new FormData();
  Object.entries(signed.params).forEach(([key, value]) => body.append(key, String(value)));
  body.append('api_key', signed.apiKey);
  body.append('signature', signed.signature);
  body.append('file', file);

  // XHR riêng: tuyệt đối không chuyển Authorization của apiFetch tới nhà cung cấp.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    const finish = (error, url) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(url);
    };
    const abort = () => { request.abort(); finish(abortError()); };
    request.open('POST', uploadUrl.href);
    request.timeout = 120000;
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.min(99, event.loaded / event.total * 100));
    };
    request.onerror = () => finish(new Error('Không kết nối được dịch vụ tải ảnh. Vui lòng thử lại.'));
    request.ontimeout = () => finish(new Error('Tải ảnh quá lâu. Vui lòng thử lại.'));
    request.onabort = () => finish(abortError());
    request.onload = () => {
      let result;
      try { result = JSON.parse(request.responseText); } catch { finish(new Error('Dịch vụ tải ảnh trả dữ liệu không hợp lệ.')); return; }
      if (request.status < 200 || request.status >= 300) {
        finish(new Error(result?.error?.message || 'Tải ảnh lên không thành công. Vui lòng thử lại.')); return;
      }
      let secureUrl;
      try { secureUrl = new URL(result.secure_url); } catch { finish(new Error('Dịch vụ tải ảnh chưa trả đường dẫn ảnh.')); return; }
      const cloud = uploadUrl.pathname.split('/')[2];
      const expectedPath = `/${cloud}/image/upload/v${result.version}/${signed.params.public_id}.${result.format}`;
      if (secureUrl.protocol !== 'https:' || secureUrl.hostname !== 'res.cloudinary.com'
        || secureUrl.username || secureUrl.password || secureUrl.port || secureUrl.search || secureUrl.hash
        || secureUrl.pathname !== expectedPath || result.public_id !== signed.params.public_id
        || result.resource_type !== 'image' || result.type !== 'upload'
        || !['jpg', 'png', 'webp'].includes(result.format)
        || !Number.isSafeInteger(result.version) || result.version < 1
        || !Number.isSafeInteger(result.bytes) || result.bytes < 1 || result.bytes > MAX_IMAGE_BYTES) {
        finish(new Error('Ảnh trả về không khớp thông tin tải lên hoặc vượt giới hạn 5 MB. Vui lòng thử lại.')); return;
      }
      onProgress?.(100);
      finish(null, secureUrl.href);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    onProgress?.(0);
    try { request.send(body); } catch { finish(new Error('Chưa gửi được ảnh lên dịch vụ. Vui lòng thử lại.')); }
  });
}

export default { upload };
