import { apiFetch } from './api'; /* Duy's code: Dùng wrapper API hiện có của client. */

// Duy's code: Lấy hồ sơ tài khoản của người dùng hiện đang đăng nhập.
export async function getProfile() {
  return apiFetch('/users/me'); /* Duy's code: API_BASE_URL đã tự thêm tiền tố /api. */
}

// Duy's code: Gửi dữ liệu tài khoản đã chỉnh sửa tới backend.
export async function updateProfile(payload) {
  return apiFetch('/users/me', { /* Duy's code: Gửi cập nhật hồ sơ qua cùng wrapper API. */
    method: 'PUT', /* Duy's code: Giữ phương thức cập nhật hồ sơ hiện có. */
    body: JSON.stringify(payload), /* Duy's code: Gửi dữ liệu hồ sơ dưới dạng JSON. */
  }); /* Duy's code: Kết thúc yêu cầu cập nhật hồ sơ. */
}

// Duy's code: Xin backend ký các tham số upload trước khi gửi ảnh tới Cloudinary.
export async function requestAvatarUploadSignature() {
  return apiFetch('/users/me/avatar-upload-signature', { method: 'POST' });
}

// Duy's code: Tải file trực tiếp tới Cloudinary và chuyển tiến độ/hủy từ ImageUpload.
function uploadToCloudinary(file, signature, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    const uploadUrl = `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`;

    formData.append('file', file);
    formData.append('api_key', signature.apiKey);
    formData.append('timestamp', signature.timestamp);
    formData.append('signature', signature.signature);
    formData.append('folder', signature.folder);
    formData.append('public_id', signature.public_id);
    formData.append('upload_preset', signature.upload_preset);
    formData.append('overwrite', signature.overwrite);
    formData.append('transformation', signature.transformation);

    request.open('POST', uploadUrl);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100);
    });
    request.addEventListener('load', () => {
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error('Cloudinary trả về dữ liệu không hợp lệ.'));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload.error?.message || 'Tải ảnh lên Cloudinary không thành công.'));
        return;
      }
      resolve(payload);
    });
    request.addEventListener('error', () => reject(new Error('Không kết nối được Cloudinary.')));
    request.addEventListener('abort', () => reject(new DOMException('Đã hủy tải ảnh.', 'AbortError')));
    request.addEventListener('timeout', () => reject(new Error('Tải ảnh lên Cloudinary quá thời gian cho phép.')));
    request.timeout = 60000;

    if (signal?.aborted) {
      reject(new DOMException('Đã hủy tải ảnh.', 'AbortError'));
      return;
    }
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(formData);
  });
}

// Duy's code: Upload avatar, nhờ backend xác minh asset rồi lưu URL vào account.
export async function uploadAvatar(file, options) {
  const signature = await requestAvatarUploadSignature();
  const upload = await uploadToCloudinary(file, signature, options);
  const profile = await apiFetch('/users/me/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatarUrl: upload.secure_url }),
  });
  return { avatar: profile.avatar, cleanupWarning: profile.cleanupWarning };
}

// Duy's code: Gỡ URL avatar khỏi hồ sơ và yêu cầu backend dọn asset Cloudinary.
export async function removeAvatar() {
  return apiFetch('/users/me/avatar', { method: 'DELETE' });
}

// Duy's code: Đọc hồ sơ sức khỏe của tài khoản đang đăng nhập.
export async function getHealthProfile() {
  return apiFetch('/users/me/health-profile');
}

// Duy's code: Lưu dữ liệu sức khỏe đã được backend kiểm tra và tính toán.
export async function saveHealthProfile(payload) {
  return apiFetch('/users/me/health-profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Duy's code: Xóa hồ sơ sức khỏe của tài khoản hiện đang đăng nhập.
export async function deleteHealthProfile() {
  return apiFetch('/users/me/health-profile', { method: 'DELETE' });
}
