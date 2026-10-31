// Tùng: ngừng tạo hoặc xác nhận thực đơn qua chatbot trước mọi writer.
function removed(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  return res.status(410).json({
    code: 'FEATURE_REMOVED',
    message: 'Chức năng tạo thực đơn qua chatbot không còn khả dụng.',
  });
}

module.exports = { preview: removed, confirm: removed };
