// requireAuth — verify JWT cho route cần bảo vệ
const { verifyToken } = require('../utils/jwt');
const accountModel = require('../models/account.model');

const MSG_INVALID_SESSION = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
const MSG_SERVER = 'Có lỗi xảy ra, vui lòng thử lại sau.';

async function requireAuth(req, res, next) {
  try {
    // 1 · Đọc Bearer token
    const [scheme, token] = String(req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: MSG_INVALID_SESSION });
    }

    // 2 · Verify chữ ký + hạn
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: MSG_INVALID_SESSION });
    }

    // 3 · Token hợp lệ nhưng tài khoản có thể đã bị xoá
    const account = await accountModel.findById(payload.accountId);
    if (!account) {
      return res.status(401).json({ message: MSG_INVALID_SESSION });
    }
    // 4 · Chỉ tài khoản 'active'và 'reported' mới được đi tiếp
    // 4 · Chặn tài khoản bị khóa hoặc đã xoá.
      if (!['active', 'reported'].includes(account.status)) { // Duy's code: reported không chặn quyền đăng nhập.
      return res.status(403).json({ message: 'Tài khoản của bạn đang bị khoá hoặc hạn chế.' });
    }

    req.account = accountModel.toPublicAccount(account); // đã lược password_hash
    return next();
  } catch (error) {
    console.error('[requireAuth]', error);
    return res.status(500).json({ message: MSG_SERVER });
  }
}

/**
 * requireAdmin — gắn SAU requireAuth cho route chỉ quản trị viên được gọi.
 * FE ẩn/hiện trang chỉ là lớp UI, chặn thật phải nằm ở đây.
 */
function requireAdmin(req, res, next) {
  if (req.account?.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập khu quản trị.' });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };