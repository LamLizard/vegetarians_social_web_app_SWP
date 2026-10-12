// Tùng — Sprint 2: ký asset mới và xác thực ảnh Shop; không phụ thuộc SDK/config chung.
const { createHash, randomUUID: cryptoRandomUUID } = require('node:crypto');
const { ShopError, invalid, requireActor } = require('./shopWorkflow');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FORMATS = ['jpg', 'png', 'webp'];
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const IMAGE_URL_PATTERN = new RegExp(`^https://res\\.cloudinary\\.com/([a-z0-9][a-z0-9_-]*)/image/upload/(?:v[1-9]\\d*/)?(vegetarian-social/shops/([1-9]\\d*)/${UUID_PATTERN})\\.(jpg|png|webp)$`);

// Thuần: snapshot được đọc/review mà không cần cấu hình hoặc gọi Cloudinary.
function parseShopImageUrl(value) {
  if (typeof value !== 'string') invalid('avtShopUrl', 'Vui lòng tải ảnh quán JPG, PNG hoặc WEBP.');
  const url = value.trim();
  const matched = IMAGE_URL_PATTERN.exec(url);
  if (!matched) invalid('avtShopUrl', 'Ảnh quán phải là ảnh tải lên từ chức năng này.');
  return { url, cloudName: matched[1], publicId: matched[2], accountId: matched[3], format: matched[4] };
}

function unavailable(code = 'SHOP_IMAGE_UPLOAD_NOT_READY') {
  return new ShopError(503, code, 'Chức năng tải ảnh quán chưa sẵn sàng. Vui lòng thử lại sau.');
}

function readConfiguration(env) {
  const supplied = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  let cloudName; let apiKey; let apiSecret;
  if (supplied.some(value => value !== undefined && value !== '')) {
    [cloudName, apiKey, apiSecret] = supplied;
  } else if (env.CLOUDINARY_URL) {
    try {
      const url = new URL(env.CLOUDINARY_URL);
      if (url.protocol !== 'cloudinary:' || url.port || (url.pathname && url.pathname !== '/') || url.search || url.hash) throw new Error();
      cloudName = url.hostname;
      apiKey = decodeURIComponent(url.username);
      apiSecret = decodeURIComponent(url.password);
    } catch { throw unavailable(); }
  }
  if (typeof cloudName !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(cloudName)
    || typeof apiKey !== 'string' || !apiKey || /[\s:]/.test(apiKey)
    || typeof apiSecret !== 'string' || !apiSecret || /[\r\n]/.test(apiSecret)) throw unavailable();
  return { cloudName, apiKey, apiSecret };
}

function createShopImageUpload({ env = process.env, fetchImpl = globalThis.fetch,
  now = Date.now, randomUUID = cryptoRandomUUID, timeoutMs = 10000 } = {}) {
  function prepareImageUpload(actor) {
    const accountId = requireActor(actor, 'member');
    const { cloudName, apiKey, apiSecret } = readConfiguration(env);
    const params = { timestamp: String(Math.floor(now() / 1000)),
      public_id: `vegetarian-social/shops/${accountId}/${randomUUID()}`,
      overwrite: 'false', allowed_formats: IMAGE_FORMATS.join(',') };
    // Cloudinary: sắp xếp key, nối các cặp chính xác rồi secret; không ký api_key/file.
    const signed = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    const signature = createHash('sha256').update(signed + apiSecret).digest('hex');
    return { uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, apiKey, signature, params };
  }

  async function verifyImageUpload(value, actor) {
    const accountId = requireActor(actor, 'member');
    const image = parseShopImageUrl(value);
    const { cloudName, apiKey, apiSecret } = readConfiguration(env);
    if (image.cloudName !== cloudName || image.accountId !== accountId) {
      invalid('avtShopUrl', 'Ảnh quán không thuộc lần tải ảnh của tài khoản này.');
    }
    if (typeof fetchImpl !== 'function') throw unavailable();
    const abort = new AbortController();
    const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 10000;
    const timer = setTimeout(() => abort.abort(), boundedTimeout);
    try {
      const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodeURIComponent(image.publicId)}`, {
        method: 'GET', redirect: 'error', signal: abort.signal,
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
      });
      if (response.status === 404) invalid('avtShopUrl', 'Ảnh quán chưa được tải lên hoặc không còn tồn tại.');
      if ([401, 403, 429].includes(response.status)) throw unavailable('SHOP_IMAGE_PROVIDER_UNAVAILABLE');
      if (!response.ok) throw new ShopError(502, 'SHOP_IMAGE_PROVIDER_ERROR', 'Không thể kiểm tra ảnh quán. Vui lòng thử lại.');
      let resource;
      try { resource = await response.json(); }
      catch { throw new ShopError(502, 'SHOP_IMAGE_PROVIDER_ERROR', 'Không thể kiểm tra ảnh quán. Vui lòng thử lại.'); }
      if (!resource || resource.public_id !== image.publicId || resource.secure_url !== image.url
        || resource.resource_type !== 'image' || resource.type !== 'upload'
        || !IMAGE_FORMATS.includes(resource.format) || resource.format !== image.format
        || !Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || resource.bytes > MAX_IMAGE_BYTES) {
        invalid('avtShopUrl', 'Ảnh quán phải là JPG, PNG hoặc WEBP, tối đa 5 MB và thuộc tài khoản này.');
      }
      return image.url;
    } catch (error) {
      if (error instanceof ShopError) throw error;
      throw unavailable('SHOP_IMAGE_PROVIDER_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }

  return { prepareImageUpload, verifyImageUpload };
}

module.exports = { MAX_IMAGE_BYTES, parseShopImageUrl, createShopImageUpload };
