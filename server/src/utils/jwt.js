// Ký / xác thực JWT cho phiên đăng nhập.
// Chốt: access token 7 ngày, KHÔNG refresh token, KHÔNG bảng auth_session.
const jwt = require('jsonwebtoken');

// Đọc env trong hàm (không cache ở module) để không phụ thuộc thứ tự dotenv.config()
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Thiếu JWT_SECRET trong server/.env');
  return secret;
};

/**
 * Ký token cho 1 tài khoản.
 * @param {{accountId: number|string}} payload  account_id là BIGINT → ép String cho gọn
 */
function signToken({ accountId }) {
  return jwt.sign(
    { accountId: String(accountId) },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

/** Token hợp lệ → trả payload; hết hạn / sai chữ ký → ném lỗi (middleware tự bắt) */
function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };