// Bảng chỉ đường của trang Bảng tin — KHÔNG viết logic ở đây.
// Gắn ở app.js:  app.use('/api/posts', require('./src/routes/post.routes'));
//
//  Khách gọi được:   GET  /preview · GET /:id/comments
//  Cần đăng nhập:    GET  /  ·  POST /  (đăng bài)  ·  POST /:id/vote  ·  POST /:id/comments
//                    POST /:id/report  ·  POST /comments/:id/report
//                    POST /youtube-check  (Khoi's code: video YouTube có phát được trên trang khác không)
const express = require('express');
const postController = require('../controllers/post.controller');
// Tùng: I-AI-01 — chỉ ba binding tạo post/đọc-gửi comment chuyển sang luồng Moderation.
const postContentController = require('../controllers/postContent.controller');
const commentDeletionController = require('../controllers/commentDeletion.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();

/** Có token → kiểm tra như requireAuth (gắn req.account). Không có → cho qua như khách. */
const optionalAuth = (req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next());

router.get('/preview', postController.getPreview);
// Duy's Code: Các route quản lý bài cá nhân đặt trước các route thao tác bài công khai.
router.get('/mine', requireAuth, requireMember, postController.getMyPosts);
router.get('/mine/:id', requireAuth, requireMember, postController.getMyPost);
router.put('/mine/:id', requireAuth, requireMember, postController.updateMyPost);
router.delete('/mine/:id', requireAuth, requireMember, postController.deleteMyPost);
router.get('/', requireAuth, postController.getFeed);
// Khoi's code: Đăng bài mới → bài 'pending' chờ Admin duyệt (Sprint 2).
// Tùng: giữ binding cũ để đối chiếu; route mới hỗ trợ auto-public/reject/pending.
// router.post('/', requireAuth, postController.createPost);
router.post('/', requireAuth, postContentController.createPost);
// Khoi's code: form Đăng bài + Tạo công thức kiểm tra link YouTube ngay khi dán
router.post('/youtube-check', requireAuth, postController.checkYouTube);

router.post('/:id/vote', requireAuth, postController.toggleVote);

// Tùng: giữ middleware và binding cũ; server chỉ trả refusal cho chính tác giả.
// router.get('/:id/comments', optionalAuth, postController.getComments);
// router.post('/:id/comments', requireAuth, postController.addComment);
router.get('/:id/comments', optionalAuth, postContentController.getComments);
router.post('/:id/comments', requireAuth, postContentController.addComment);
// Tùng: xóa bình luận xác thực actor và xử lý báo cáo trong cùng giao dịch.
router.delete('/comments/:commentId', requireAuth, commentDeletionController.remove);

router.post('/:id/report', requireAuth, postController.reportPost);
router.post('/comments/:id/report', requireAuth, postController.reportComment);

module.exports = router;
