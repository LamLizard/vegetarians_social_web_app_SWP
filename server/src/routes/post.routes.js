// Bảng chỉ đường của trang Bảng tin — KHÔNG viết logic ở đây.
// Gắn ở app.js:  app.use('/api/posts', require('./src/routes/post.routes'));
//
//  Khách gọi được:   GET  /preview · GET /:id/comments
//  Cần đăng nhập:    GET  /  ·  POST /  (đăng bài)  ·  POST /:id/vote  ·  POST /:id/comments
//                    POST /:id/report  ·  POST /comments/:id/report
const express = require('express');
const postController = require('../controllers/post.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

/** Có token → kiểm tra như requireAuth (gắn req.account). Không có → cho qua như khách. */
const optionalAuth = (req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next());

router.get('/preview', postController.getPreview);
router.get('/', requireAuth, postController.getFeed);
// Khoi's code: Đăng bài mới → bài 'pending' chờ Admin duyệt (Sprint 2).
router.post('/', requireAuth, postController.createPost);

router.post('/:id/vote', requireAuth, postController.toggleVote);

router.get('/:id/comments', optionalAuth, postController.getComments);
router.post('/:id/comments', requireAuth, postController.addComment);

router.post('/:id/report', requireAuth, postController.reportPost);
router.post('/comments/:id/report', requireAuth, postController.reportComment);

module.exports = router;
