// Khoi's code: API upload ảnh — cần đăng nhập. Gắn ở app.js: app.use('/api/uploads', ...)
//   POST /image   body form-data, field tên "image" (JPG/PNG/WEBP, tối đa 5 MB) → { url }
const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/upload.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(), // giữ ảnh trong RAM, không ghi ra ổ đĩa server
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Chỉ nhận ảnh JPG, PNG hoặc WEBP'), ok);
  },
});

/** Bọc multer để lỗi (file quá lớn, sai loại) trả JSON 400 thay vì trang lỗi HTML. */
const uploadOne = (req, res, next) =>
  upload.single('image')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Ảnh tối đa 5 MB' });
    if (err) return res.status(400).json({ message: err.message });
    return next();
  });

router.post('/image', requireAuth, uploadOne, uploadController.uploadImage);

module.exports = router;
