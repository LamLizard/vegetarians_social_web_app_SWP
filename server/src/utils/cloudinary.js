const crypto = require('node:crypto');

// Duy's code: Quy định namespace và giới hạn upload avatar dùng chung cho backend.
const AVATAR_FOLDER = 'greenbowl';
const AVATAR_UPLOAD_PRESET = 'greenbowl_avatar_signed';
const AVATAR_FORMATS = 'jpg,jpeg,png,webp';
const AVATAR_TRANSFORMATION = 'c_limit,w_2048,h_2048';
const MAX_AVATAR_DIMENSION = 2048;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Duy's code: Báo lỗi riêng để controller trả phản hồi cấu hình thiếu phù hợp.
class CloudinaryConfigurationError extends Error {
  constructor() {
    super('Cloudinary chưa được cấu hình trên máy chủ.');
    this.name = 'CloudinaryConfigurationError';
  }
}

// Duy's code: Đọc thông tin bí mật chỉ từ môi trường backend và kiểm tra cloud name.
function getConfiguration() {
  // Duy's code: Đọc bộ khóa bí mật từ process.env, không trả chúng về client.
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  // Duy's code: Dừng cấp chữ ký nếu thiếu cấu hình bắt buộc.
  if (!cloudName || !apiKey || !apiSecret) throw new CloudinaryConfigurationError();
  // Duy's code: Chặn cloud name sai định dạng trước khi tạo endpoint Cloudinary.
  if (!/^[a-z0-9-]+$/i.test(cloudName)) throw new Error('Cloudinary cloud name không hợp lệ.');
  // Duy's code: Trả cấu hình cho các helper phía server.
  return { cloudName, apiKey, apiSecret };
}

// Duy's code: Tách asset development khỏi production để tránh lẫn dữ liệu.
function getEnvironmentName() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// Duy's code: Tạo thư mục avatar riêng theo môi trường và tài khoản.
function getAvatarFolder(accountId) {
  return `${AVATAR_FOLDER}/${getEnvironmentName()}/avatars/${accountId}`;
}

// Duy's code: Tạo chữ ký SHA-1 theo thứ tự tham số Cloudinary yêu cầu.
function createSignature(parameters, apiSecret) {
  // Duy's code: Sắp xếp khóa để chuỗi ký nhất quán với quy ước Cloudinary.
  const canonical = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join('&');
  // Duy's code: Tạo chữ ký từ chuỗi tham số và API Secret.
  return crypto.createHash('sha1').update(`${canonical}${apiSecret}`).digest('hex');
}

// Duy's code: Cấp tham số upload và chữ ký có thời hạn ngắn cho tài khoản đã đăng nhập.
function createAvatarUploadSignature(accountId, timestamp = Math.floor(Date.now() / 1000)) {
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  // Duy's code: Đặt asset trong folder riêng của tài khoản hiện tại.
  const folder = getAvatarFolder(accountId);
  // Duy's code: Tạo public ID ngẫu nhiên để tránh đè lên ảnh cũ.
  const publicId = crypto.randomUUID();
  // Duy's code: Ưu tiên tên preset cấu hình, nếu thiếu dùng tên preset chuẩn của ứng dụng.
  const uploadPreset = process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET || AVATAR_UPLOAD_PRESET;
  // Duy's code: Ký toàn bộ tham số quan trọng bao gồm giới hạn transformation.
  const parameters = {
    folder,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(timestamp),
    transformation: AVATAR_TRANSFORMATION,
    upload_preset: uploadPreset,
  };

  // Duy's code: Chỉ gửi dữ liệu công khai và chữ ký; không gửi API Secret tới trình duyệt.
  return {
    ...parameters,
    signature: createSignature(parameters, apiSecret),
    apiKey,
    cloudName,
    resourceType: 'image',
    maxFileSize: MAX_AVATAR_BYTES,
    allowedFormats: AVATAR_FORMATS,
  };
}

// Duy's code: Chỉ chấp nhận URL Cloudinary thuộc namespace avatar của tài khoản.
function getAvatarPublicId(avatarUrl, accountId) {
  // Duy's code: Từ chối URL không hợp lệ hoặc dài bất thường trước khi phân tích.
  if (typeof avatarUrl !== 'string' || avatarUrl.length > 1000) return null;

  const { cloudName } = getConfiguration();
  let parsedUrl;
  try {
    // Duy's code: Phân tích URL để kiểm tra host, protocol và đường dẫn.
    parsedUrl = new URL(avatarUrl);
  } catch {
    return null;
  }

  // Duy's code: Chỉ chấp nhận URL HTTPS từ host Cloudinary.
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `res.cloudinary.com`) return null;
  // Duy's code: Khóa resource và cloud name vào product environment đã cấu hình.
  if (!parsedUrl.pathname.startsWith(`/${cloudName}/image/upload/`)) return null;

  // Duy's code: Tách các đoạn đường dẫn để đọc version, folder và file name.
  const path = parsedUrl.pathname.slice(`/${cloudName}/image/upload/`.length);
  const segments = path.split('/').filter(Boolean);
  // Duy's code: Bỏ version segment tùy chọn của URL phân phối Cloudinary.
  if (/^v\d+$/.test(segments[0] || '')) segments.shift();
  // Duy's code: Yêu cầu folder tài khoản và tên file có phần mở rộng.
  if (segments.length < 5) return null;

  // Duy's code: Tách public ID khỏi extension và tái tạo folder đã ký.
  const assetName = segments.pop();
  const extensionIndex = assetName.lastIndexOf('.');
  if (extensionIndex < 0) return null;
  const extension = assetName.slice(extensionIndex + 1);
  const publicId = assetName.slice(0, extensionIndex);
  const folder = segments.join('/');
  // Duy's code: Chặn asset ngoài folder tài khoản, ID không UUID hoặc định dạng lạ.
  if (folder !== getAvatarFolder(accountId)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(publicId) || !/^(jpg|jpeg|png|webp)$/i.test(extension)) return null;
  // Duy's code: Trả public ID đã được xác thực để dùng với Cloudinary Admin API.
  return `${folder}/${publicId}`;
}

// Duy's code: Xác minh asset qua Admin API trước khi URL được phép lưu vào hồ sơ.
async function getAvatarAsset(avatarUrl, accountId) {
  const publicId = getAvatarPublicId(avatarUrl, accountId);
  // Duy's code: Không gọi dịch vụ Cloudinary khi URL không qua kiểm tra namespace.
  if (!publicId) return null;

  const { cloudName, apiKey, apiSecret } = getConfiguration();
  // Duy's code: Encode từng phần public ID để gọi đúng resource endpoint.
  const encodedPublicId = publicId.split('/').map(encodeURIComponent).join('/');
  // Duy's code: Dùng Admin API để xác nhận asset thực sự tồn tại, không tin URL do client gửi.
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodedPublicId}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  // Duy's code: Asset không tồn tại được xem là URL không thể lưu.
  if (response.status === 404) return null;
  // Duy's code: Nêu lỗi dịch vụ rõ ràng nếu Cloudinary không thể xác minh.
  if (!response.ok) throw new Error(`Cloudinary asset verification failed (${response.status}).`);

  // Duy's code: Đọc metadata thật của ảnh để kiểm tra ID, định dạng, kích thước và URL HTTPS.
  const asset = await response.json();
  if (
    asset.public_id !== publicId
    || !/^(jpg|jpeg|png|webp)$/i.test(asset.format || '')
    || !Number.isSafeInteger(asset.bytes)
    || asset.bytes < 1
    || asset.bytes > MAX_AVATAR_BYTES
    || !Number.isSafeInteger(asset.width)
    || asset.width < 1
    || asset.width > MAX_AVATAR_DIMENSION
    || !Number.isSafeInteger(asset.height)
    || asset.height < 1
    || asset.height > MAX_AVATAR_DIMENSION
    || typeof asset.secure_url !== 'string'
  ) return null;

  // Duy's code: Chỉ trả asset đã đạt toàn bộ giới hạn ứng dụng.
  return { publicId, secureUrl: asset.secure_url, width: asset.width, height: asset.height };
}

// Duy's code: Xóa asset chỉ khi public ID nằm trong thư mục avatar của đúng tài khoản.
async function deleteAvatar(publicId, accountId) {
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const folder = getAvatarFolder(accountId);
  // Duy's code: Ngăn xóa asset thuộc folder của một tài khoản khác.
  if (typeof publicId !== 'string' || !publicId.startsWith(`${folder}/`)) {
    throw new Error('Cloudinary public ID không thuộc tài khoản hiện tại.');
  }

  // Duy's code: Ký lệnh destroy theo timestamp và public ID cụ thể.
  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = { invalidate: 'true', public_id: publicId, timestamp };
  const body = new URLSearchParams({
    ...parameters,
    api_key: apiKey,
    signature: createSignature(parameters, apiSecret),
  });

  // Duy's code: Gửi lệnh xóa đã ký qua HTTPS tới Cloudinary.
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  // Duy's code: Báo lỗi khi yêu cầu xóa không thành công ở tầng HTTP.
  if (!response.ok) throw new Error(`Cloudinary delete request failed (${response.status}).`);

  // Duy's code: Chấp nhận xóa thành công hoặc asset đã được dọn trước đó.
  const result = await response.json();
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary delete failed (${result.result || 'unknown result'}).`);
  }
}

module.exports = {
  AVATAR_FORMATS,
  AVATAR_TRANSFORMATION,
  AVATAR_UPLOAD_PRESET,
  CloudinaryConfigurationError,
  MAX_AVATAR_DIMENSION,
  MAX_AVATAR_BYTES,
  createAvatarUploadSignature,
  createSignature,
  deleteAvatar,
  getAvatarAsset,
  getAvatarFolder,
  getAvatarPublicId,
};
