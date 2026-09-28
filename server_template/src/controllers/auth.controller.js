import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as User from '../models/user.model.js';
import * as Session from '../models/session.model.js';
import { hashToken, signToken, tokenExpiresAt } from '../utils/jwt.js';

// Luật kiểm tra – giữ giống hệt FE (AuthPage.jsx) để thông báo lỗi 2 bên khớp nhau
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isStrongPassword = (pw) => typeof pw === 'string' && pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
const PASSWORD_RULE = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.';
const SALT_ROUNDS = 10;

/** Tạo phiên mới trong auth_session + ký JWT gắn với phiên đó. */
async function openSession(req, account, remember) {
  const sessionId = crypto.randomUUID();
  const token = signToken({ accountId: account.account_id, sessionId, role: account.role }, remember);
  await Session.create({
    sessionId,
    accountId: account.account_id,
    tokenHash: hashToken(token),
    expiresAt: tokenExpiresAt(token),
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  await User.touchLastLogin(account.account_id);
  return token;
}

/** POST /api/auth/register  { fullName, email, password } → 201 { token, user } (đăng ký xong vào luôn) */
export async function register(req, res, next) {
  try {
    const { fullName = '', email = '', password = '' } = req.body ?? {};
    if (fullName.trim().length < 2) {
      return res.status(400).json({ field: 'fullName', message: 'Vui lòng nhập họ và tên.' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ field: 'email', message: 'Email chưa đúng định dạng, vd: ten@gmail.com' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ field: 'password', message: PASSWORD_RULE });
    }
    if (await User.findByEmail(email)) {
      return res.status(409).json({ field: 'email', message: 'Email này đã được đăng ký.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const account = await User.create({ email, passwordHash, fullName });
    const token = await openSession(req, account, true);
    return res.status(201).json({ token, user: User.toPublic(account) });
  } catch (err) {
    if (err.code === '23505') { // 2 request đăng ký cùng email cùng lúc → vướng UNIQUE
      return res.status(409).json({ field: 'email', message: 'Email này đã được đăng ký.' });
    }
    return next(err);
  }
}

/** POST /api/auth/login  { email, password, remember } → 200 { token, user } */
export async function login(req, res, next) {
  try {
    const { email = '', password = '', remember = true } = req.body ?? {};
    if (!email.trim() || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const account = await User.findByEmail(email);
    const ok = account && account.status !== 'deleted' && await bcrypt.compare(password, account.password_hash);
    if (!ok) {
      // Không nói rõ sai email hay sai mật khẩu → tránh dò email đã đăng ký
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }
    if (account.status === 'locked') {
      return res.status(403).json({ locked: true, message: 'Tài khoản của bạn đang bị khoá.' });
    }

    const token = await openSession(req, account, Boolean(remember));
    return res.json({ token, user: User.toPublic(account) });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/auth/me (cần token) → { user } – FE gọi khi mở app để kiểm tra phiên còn sống */
export function me(req, res) {
  res.json({ user: User.toPublic(req.user) });
}

/** POST /api/auth/logout (cần token) → thu hồi phiên hiện tại */
export async function logout(req, res, next) {
  try {
    await Session.revoke(req.sessionId);
    return res.json({ message: 'Đã đăng xuất.' });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/auth/password (cần token)  { currentPassword, newPassword } */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword = '', newPassword = '' } = req.body ?? {};
    if (!(await bcrypt.compare(currentPassword, req.user.password_hash))) {
      return res.status(400).json({ field: 'currentPassword', message: 'Mật khẩu hiện tại không đúng.' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ field: 'newPassword', message: PASSWORD_RULE });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ field: 'newPassword', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    await User.updatePassword(req.user.account_id, await bcrypt.hash(newPassword, SALT_ROUNDS));
    // Giữ phiên đang dùng, đăng xuất các thiết bị khác
    await Session.revokeOthers(req.user.account_id, req.sessionId);
    return res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    return next(err);
  }
}
