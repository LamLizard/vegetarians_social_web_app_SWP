const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());          // dev cho thoáng; sau siết origin từ client/.env (CLIENT_URL)
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Mỗi tính năng của nhóm thêm 2 dòng ở đây ----
const authRoutes = require('./src/routes/auth.routes');
app.use('/api/auth', authRoutes);

// Duy's code: Kết nối API xem và cập nhật hồ sơ của tài khoản hiện tại.
app.use('/api/users', require('./src/routes/user.routes'));
// Duy's code: Hoàn tất điểm nối API hồ sơ User.

// Tung's code: Đăng ký API duyệt bài viết và xử lý báo cáo bài viết cho trang Admin.
// Router tự kiểm tra đăng nhập (requireAuth) và quyền Admin (requireAdmin)
// trước các endpoint danh sách, chi tiết và quyết định tại /posts và /reports.
const postModerationRoutes = require('./src/routes/postModeration.routes');
app.use('/api/admin/moderation', postModerationRoutes);
// Tung's code: Kết thúc điểm nối API kiểm duyệt; giữ nguyên các route hiện có.

// Duy's code: Kết nối API quản lý tài khoản thành viên cho trang Admin.
app.use('/api/admin/members', require('./src/routes/admin-member.routes'));

app.use('/api/admin', require('./src/routes/admin.routes'));
// Khoi's code: API trang Bảng tin (xem 3 bài khách, feed, vote, bình luận, báo cáo).
app.use('/api/posts', require('./src/routes/post.routes'));

module.exports = app;
