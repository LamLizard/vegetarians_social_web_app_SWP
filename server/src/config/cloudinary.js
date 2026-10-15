// Khoi's code: Cấu hình Cloudinary cho ảnh bìa (bài viết, công thức, món) — đọc khóa từ server/.env, không ghi khóa vào code.
// Dùng bộ biến riêng CLOUDINARY_POST_* để không trùng tên với avatar (Duy) và ảnh quán (Tùng):
// trong .env, biến khai báo trùng tên thì dòng cuối thắng → ảnh bị đẩy nhầm sang tài khoản người khác.
// Máy nào chưa khai báo CLOUDINARY_POST_* thì dùng lại nguyên bộ CLOUDINARY_* chung (không trộn 2 bộ).
const cloudinary = require('cloudinary').v2;

const env = process.env;
const hasPostKeys = Boolean(env.CLOUDINARY_POST_CLOUD_NAME);

/** Cloud name nơi lưu ảnh bìa — upload và kiểm tra link ảnh bìa phải dùng CÙNG giá trị này */
const POST_CLOUD_NAME = hasPostKeys ? env.CLOUDINARY_POST_CLOUD_NAME : env.CLOUDINARY_CLOUD_NAME;

cloudinary.config({
  cloud_name: POST_CLOUD_NAME,
  api_key: hasPostKeys ? env.CLOUDINARY_POST_API_KEY : env.CLOUDINARY_API_KEY,
  api_secret: hasPostKeys ? env.CLOUDINARY_POST_API_SECRET : env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = { cloudinary, POST_CLOUD_NAME };
