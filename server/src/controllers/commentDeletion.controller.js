async function remove(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  // Tùng: tạm chặn đến khi toàn bộ luồng nhật ký bảo vệ nội dung đã xóa.
  return res.status(503).json({ code: 'DELETE_UNAVAILABLE', message: 'Tính năng xóa bình luận tạm thời chưa khả dụng.' });
}

module.exports = { remove };
