// Khoi's code: Nhận ảnh từ client (đã qua multer) rồi đẩy lên Cloudinary, trả link về.
const cloudinary = require('../config/cloudinary');

/** Đẩy ảnh đang nằm trong RAM (buffer) lên Cloudinary. */
function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'greenbowl/posts', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Chưa chọn ảnh' });
  try {
    const result = await uploadBuffer(req.file.buffer);
    return res.status(201).json({ url: result.secure_url });
  } catch (err) {
    console.error('[upload] Cloudinary lỗi:', err.message);
    // 400 từ Cloudinary = ảnh bị từ chối (vd vượt 25 megapixel của gói miễn phí) → thử lại cũng vô ích, báo rõ cho người dùng
    if (err.http_code === 400) {
      return res.status(400).json({ message: 'Ảnh không hợp lệ hoặc độ phân giải quá lớn (tối đa 25 megapixel). Hãy chọn ảnh khác.' });
    }
    return res.status(502).json({ message: 'Không upload được ảnh, vui lòng thử lại' });
  }
}

module.exports = { uploadImage };
