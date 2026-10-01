// register · login · getMe — logout phía FE; đổi mật khẩu thuộc module Hồ sơ (user.*)
const bcrypt = require('bcrypt');
const accountModel = require('../models/account.model');
const { signToken } = require('../utils/jwt');
//
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Câu lỗi dùng chung — FE hiện nguyên văn lên UI nên phải là tiếng Việt
const MSG = {
  invalidCredentials: 'Email hoặc mật khẩu không đúng.', // dùng CHUNG cho sai email lẫn sai mật khẩu
  emailTaken: 'Email này đã được sử dụng.',
  server: 'Có lỗi xảy ra, vui lòng thử lại sau.',
};

const reply = (res, status, payload) => res.status(status).json(payload);

/** POST /api/auth/register — đăng ký xong trả token luôn để FE tự đăng nhập */
async function register(req, res) {
  try {
    const fullName = String(req.body?.fullName ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (fullName.length < 2) return reply(res, 400, { message: 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).' });
    if (email.length > 30) return reply(res, 400, { message: 'Email đăng ký không được vượt quá 30 ký tự.' });
    if (!EMAIL_RE.test(email)) return reply(res, 400, { message: 'Email không hợp lệ.' });
    if (password.length < 8 || password.length > 20) {
      return reply(res, 400, { message: 'Mật khẩu cần từ 8 đến 20 ký tự.' });
    }
    if (password.toLowerCase() === email.toLowerCase()) {
      return reply(res, 400, { message: 'Mật khẩu không được trùng với email.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created = await accountModel.create({ email, passwordHash, fullName });
    const account = await accountModel.findById(created.id);

    return reply(res, 201, {
      token: signToken({ accountId: account.id }),
      user: accountModel.toPublicAccount(account),
    });
  } catch (error) {
    // 23505 = vi phạm UNIQUE (email đã tồn tại) — bắt ở đây để 2 request cùng lúc vẫn đúng
    if (error?.code === '23505') return reply(res, 409, { message: MSG.emailTaken });
    console.error('[auth.register]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/** POST /api/auth/login */
async function login(req, res) {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    const account = await accountModel.findByEmail(email);
    const passwordOk = account ? await bcrypt.compare(password, account.passwordHash) : false;

    // Không tìm thấy email HOẶC sai mật khẩu → cùng 1 câu, không tiết lộ email có tồn tại hay không
    if (!account || !passwordOk) return reply(res, 401, { message: MSG.invalidCredentials });

    if (account.status === 'deleted') return reply(res, 401, { message: MSG.invalidCredentials });
    if (account.status === 'locked') return reply(res, 403, { message: 'Tài khoản đã bị khoá.' });
    if (account.status === 'reported') return reply(res, 403, { message: 'Tài khoản đang bị hạn chế.' });

    await accountModel.touchLastLogin(account.id);

    return reply(res, 200, {
      token: signToken({ accountId: account.id }),
      user: accountModel.toPublicAccount(account),
    });
  } catch (error) {
    console.error('[auth.login]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/** GET /api/auth/me — requireAuth đã gán req.account (không có password_hash) */
async function getMe(req, res) {
  try {
    return reply(res, 200, { user: req.account });
  } catch (error) {
    console.error('[auth.getMe]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

module.exports = { register, login, getMe };