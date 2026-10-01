import { hashToken, verifyToken } from '../utils/jwt.js';
import * as Session from '../models/session.model.js';
import * as User from '../models/user.model.js';

/**
 * requireAuth – gắn trước route cần đăng nhập:
 *   router.get('/me', requireAuth, controller.me)
 * Thành công → req.user (dữ liệu account) + req.sessionId.
 * Thất bại → 401 (FE bắt 401 để tự đăng xuất) hoặc 403 nếu tài khoản bị khoá.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Bạn cần đăng nhập để tiếp tục.' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({ message: expired ? 'Phiên đăng nhập đã hết hạn.' : 'Token không hợp lệ.' });
  }

  try {
    // JWT hợp lệ vẫn phải còn phiên trong DB (đã đăng xuất / đổi mật khẩu → bị thu hồi)
    const session = await Session.findActive(payload.sid, hashToken(token));
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã kết thúc.' });

    const account = await User.findById(session.account_id);
    if (!account || account.status === 'deleted') {
      return res.status(401).json({ message: 'Tài khoản không tồn tại.' });
    }
    if (account.status === 'locked') {
      await Session.revoke(session.session_id);
      return res.status(401).json({ locked: true, message: 'Tài khoản của bạn đang bị khoá.' });
    }

    req.user = account;
    req.sessionId = session.session_id;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Dùng sau requireAuth: requireRole('admin') */
export const requireRole = (...roles) => (req, res, next) => (
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' })
);
