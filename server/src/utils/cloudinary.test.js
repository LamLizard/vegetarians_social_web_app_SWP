const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AVATAR_TRANSFORMATION,
  createAvatarUploadSignature,
  createSignature,
  getAvatarPublicId,
} = require('./cloudinary');

// Duy's code: Kiểm tra chữ ký upload gắn account namespace, public ID duy nhất và giới hạn ảnh.
test('avatar upload signature binds an account folder, unique ID, and bounded transformation', () => {
  // Duy's code: Cấu hình thông tin giả lập trong tiến trình test, không dùng credential thật.
  process.env.CLOUDINARY_CLOUD_NAME = 'greenbowl-test';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET = 'greenbowl_avatar_signed';
  process.env.NODE_ENV = 'development';
  // Duy's code: Tạo chữ ký upload với timestamp cố định để kiểm tra tham số ổn định.
  const signature = createAvatarUploadSignature('42', 123);
  const { signature: actualSignature, apiKey, cloudName, resourceType, maxFileSize, allowedFormats, ...parameters } = signature;

  // Duy's code: Xác nhận folder chỉ thuộc account 42 và public ID là UUID.
  assert.equal(parameters.folder, 'greenbowl/development/avatars/42');
  assert.match(parameters.public_id, /^[0-9a-f-]{36}$/i);
  // Duy's code: Xác nhận upload không ghi đè và có transformation đã ký.
  assert.equal(parameters.overwrite, 'false');
  assert.equal(parameters.transformation, AVATAR_TRANSFORMATION);
  assert.equal(actualSignature, createSignature(parameters, 'test-secret'));
  // Duy's code: Xác nhận cấu hình phản hồi chỉ lộ các giá trị công khai cần cho browser.
  assert.equal(apiKey, 'test-key');
  assert.equal(cloudName, 'greenbowl-test');
  assert.equal(resourceType, 'image');
  // Duy's code: Xác nhận giới hạn file và định dạng được chuyển tới component upload.
  assert.equal(maxFileSize, 5 * 1024 * 1024);
  assert.equal(allowedFormats, 'jpg,jpeg,png,webp');
});

// Duy's code: Đảm bảo thứ tự khóa đầu vào không làm thay đổi chữ ký.
test('createSignature sorts parameters before hashing', () => {
  assert.equal(
    createSignature({ timestamp: '123', folder: 'avatars' }, 'secret'),
    createSignature({ folder: 'avatars', timestamp: '123' }, 'secret'),
  );
});

// Duy's code: Chấp nhận URL ảnh Cloudinary thuộc folder của account đã yêu cầu.
test('getAvatarPublicId accepts an account avatar URL in the configured folder', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'greenbowl-test';
  process.env.NODE_ENV = 'development';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  // Duy's code: Tạo URL mẫu có version để kiểm tra việc trích xuất public ID.
  const accountId = '42';
  const publicId = '12345678-1234-4234-8234-123456789abc';

  assert.equal(
    getAvatarPublicId(
      `https://res.cloudinary.com/greenbowl-test/image/upload/v123/greenbowl/development/avatars/${accountId}/${publicId}.webp`,
      accountId,
    ),
    `greenbowl/development/avatars/${accountId}/${publicId}`,
  );
});

// Duy's code: Từ chối URL không thuộc Cloudinary hoặc thuộc tài khoản khác.
test('getAvatarPublicId rejects non-Cloudinary and another account URLs', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'greenbowl-test';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const publicId = '12345678-1234-4234-8234-123456789abc';

  assert.equal(getAvatarPublicId('https://example.com/avatar.jpg', '42'), null);
  assert.equal(
    getAvatarPublicId(
      `https://res.cloudinary.com/greenbowl-test/image/upload/greenbowl/development/avatars/99/${publicId}.jpg`,
      '42',
    ),
    null,
  );
});
