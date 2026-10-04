const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AVATAR_TRANSFORMATION,
  createAvatarUploadSignature,
  createSignature,
  getAvatarPublicId,
} = require('./cloudinary');

test('avatar upload signature binds an account folder, unique ID, and bounded transformation', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'greenbowl-test';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET = 'greenbowl_avatar_signed';
  process.env.NODE_ENV = 'development';
  const signature = createAvatarUploadSignature('42', 123);
  const { signature: actualSignature, apiKey, cloudName, resourceType, maxFileSize, allowedFormats, ...parameters } = signature;

  assert.equal(parameters.folder, 'greenbowl/development/avatars/42');
  assert.match(parameters.public_id, /^[0-9a-f-]{36}$/i);
  assert.equal(parameters.overwrite, 'false');
  assert.equal(parameters.transformation, AVATAR_TRANSFORMATION);
  assert.equal(actualSignature, createSignature(parameters, 'test-secret'));
  assert.equal(apiKey, 'test-key');
  assert.equal(cloudName, 'greenbowl-test');
  assert.equal(resourceType, 'image');
  assert.equal(maxFileSize, 5 * 1024 * 1024);
  assert.equal(allowedFormats, 'jpg,jpeg,png,webp');
});

test('createSignature sorts parameters before hashing', () => {
  assert.equal(
    createSignature({ timestamp: '123', folder: 'avatars' }, 'secret'),
    createSignature({ folder: 'avatars', timestamp: '123' }, 'secret'),
  );
});

test('getAvatarPublicId accepts an account avatar URL in the configured folder', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'greenbowl-test';
  process.env.NODE_ENV = 'development';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
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
