const crypto = require('node:crypto');

const AVATAR_FOLDER = 'greenbowl';
const AVATAR_UPLOAD_PRESET = 'greenbowl_avatar_signed';
const AVATAR_FORMATS = 'jpg,jpeg,png,webp';
const AVATAR_TRANSFORMATION = 'c_limit,w_2048,h_2048';
const MAX_AVATAR_DIMENSION = 2048;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

class CloudinaryConfigurationError extends Error {
  constructor() {
    super('Cloudinary chưa được cấu hình trên máy chủ.');
    this.name = 'CloudinaryConfigurationError';
  }
}

function getConfiguration() {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !apiKey || !apiSecret) throw new CloudinaryConfigurationError();
  if (!/^[a-z0-9-]+$/i.test(cloudName)) throw new Error('Cloudinary cloud name không hợp lệ.');
  return { cloudName, apiKey, apiSecret };
}

function getEnvironmentName() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function getAvatarFolder(accountId) {
  return `${AVATAR_FOLDER}/${getEnvironmentName()}/avatars/${accountId}`;
}

function createSignature(parameters, apiSecret) {
  const canonical = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${canonical}${apiSecret}`).digest('hex');
}

function createAvatarUploadSignature(accountId, timestamp = Math.floor(Date.now() / 1000)) {
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const folder = getAvatarFolder(accountId);
  const publicId = crypto.randomUUID();
  const uploadPreset = process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET || AVATAR_UPLOAD_PRESET;
  const parameters = {
    folder,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(timestamp),
    transformation: AVATAR_TRANSFORMATION,
    upload_preset: uploadPreset,
  };

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

function getAvatarPublicId(avatarUrl, accountId) {
  if (typeof avatarUrl !== 'string' || avatarUrl.length > 1000) return null;

  const { cloudName } = getConfiguration();
  let parsedUrl;
  try {
    parsedUrl = new URL(avatarUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `res.cloudinary.com`) return null;
  if (!parsedUrl.pathname.startsWith(`/${cloudName}/image/upload/`)) return null;

  const path = parsedUrl.pathname.slice(`/${cloudName}/image/upload/`.length);
  const segments = path.split('/').filter(Boolean);
  if (/^v\d+$/.test(segments[0] || '')) segments.shift();
  if (segments.length < 5) return null;

  const assetName = segments.pop();
  const extensionIndex = assetName.lastIndexOf('.');
  if (extensionIndex < 0) return null;
  const extension = assetName.slice(extensionIndex + 1);
  const publicId = assetName.slice(0, extensionIndex);
  const folder = segments.join('/');
  if (folder !== getAvatarFolder(accountId)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(publicId) || !/^(jpg|jpeg|png|webp)$/i.test(extension)) return null;
  return `${folder}/${publicId}`;
}

async function getAvatarAsset(avatarUrl, accountId) {
  const publicId = getAvatarPublicId(avatarUrl, accountId);
  if (!publicId) return null;

  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const encodedPublicId = publicId.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodedPublicId}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloudinary asset verification failed (${response.status}).`);

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

  return { publicId, secureUrl: asset.secure_url, width: asset.width, height: asset.height };
}

async function deleteAvatar(publicId, accountId) {
  const { cloudName, apiKey, apiSecret } = getConfiguration();
  const folder = getAvatarFolder(accountId);
  if (typeof publicId !== 'string' || !publicId.startsWith(`${folder}/`)) {
    throw new Error('Cloudinary public ID không thuộc tài khoản hiện tại.');
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const parameters = { invalidate: 'true', public_id: publicId, timestamp };
  const body = new URLSearchParams({
    ...parameters,
    api_key: apiKey,
    signature: createSignature(parameters, apiSecret),
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Cloudinary delete request failed (${response.status}).`);

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
