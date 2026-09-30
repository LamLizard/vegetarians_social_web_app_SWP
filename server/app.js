const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());          // dev cho thoáng; sau siết origin từ client/.env (CLIENT_URL)
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Mỗi tính năng của nhóm thêm 2 dòng ở đây ----
const authRoutes = require('./src/routes/auth.routes');
app.use('/api/auth', authRoutes);

// Tung's code: Đăng ký API duyệt bài viết và xử lý báo cáo bài viết cho trang Admin.
// Router tự kiểm tra đăng nhập (requireAuth) và quyền Admin (requireAdmin)
// trước các endpoint danh sách, chi tiết và quyết định tại /posts và /reports.
const postModerationRoutes = require('./src/routes/postModeration.routes');
app.use('/api/admin/moderation', postModerationRoutes);
// Tung's code: Kết thúc điểm nối API kiểm duyệt; giữ nguyên các route hiện có.

app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/admin/members', require('./src/routes/admin-member.routes'));

// Khoi's code: API trang Bảng tin (xem 3 bài khách, feed, vote, bình luận, báo cáo).
app.use('/api/posts', require('./src/routes/post.routes'));

app.use('/api', (req, res) => {
	const path = `${req.baseUrl}${req.path}`;
	return res.status(404).json({ message: `Không tìm thấy API ${req.method} ${path}` });
});

module.exports = app;
