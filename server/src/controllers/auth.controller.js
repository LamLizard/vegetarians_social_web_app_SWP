// register · login · getMe — logout phía FE; đổi mật khẩu thuộc module Hồ sơ (user.*)
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const accountModel = require('../models/account.model');
const authModel = require('../models/auth.model');
const { sendRegisterOtpEmail, sendPasswordResetOtpEmail } = require('../utils/mailer');
const { signToken } = require('../utils/jwt');

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_EXPIRES_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
// Vé đặt lại mật khẩu: đủ lâu để người dùng đọc mail → nhập OTP → gõ mật khẩu mới.
const RESET_TOKEN_EXPIRES_MS = 10 * 60 * 1000;

const MSG = {
  invalidCredentials: 'Email hoặc mật khẩu không đúng.',
  emailTaken: 'Email này đã được sử dụng.',
  server: 'Có lỗi xảy ra, vui lòng thử lại sau.',
  otpWrong: 'Mã xác minh không đúng. Bạn còn {n} lần thử.',
  otpExpired: 'Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.',
  otpTooMany: 'Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.',
  noPending: 'Không tìm thấy yêu cầu đăng ký. Vui lòng thực hiện lại từ đầu.',
  mailFailed: 'Không gửi được email xác minh, vui lòng thử lại sau.',
  // Quên mật khẩu
  emailNotRegistered: 'Email chưa được đăng ký.',
  noResetRequest: 'Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng nhập lại email.',
  resetSessionExpired: 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng nhập lại email để nhận mã mới.',
};


const reply = (res, status, payload) => res.status(status).json(payload);
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
// Vé đặt lại mật khẩu: chuỗi 32 byte ngẫu nhiên; DB chỉ giữ sha256 để lộ DB cũng không dùng lại được.
const generateResetToken = () => crypto.randomBytes(32).toString('hex');
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');


// Render free chặn outbound SMTP (port 25/465/587) nên không gửi được mail OTP.
// MAIL_FALLBACK_LOG=1 (chỉ dùng cho demo/không có email provider): giữ OTP lại và ghi
// mã vào log máy chủ, thay vì xoá OTP + trả 500 để người dùng không đăng ký được.
const mailFallbackToLog = () => String(process.env.MAIL_FALLBACK_LOG || '') === '1';

function getRetryAfterSeconds(lastSentAt) {
  if (!lastSentAt) return 0;
  const msPassed = Date.now() - new Date(lastSentAt).getTime();
  const remaining = OTP_COOLDOWN_MS - msPassed;
  return Math.max(0, Math.ceil(remaining / 1000));
}

/** POST /api/auth/register — gửi email OTP để xác minh trước khi tạo tài khoản */
async function register(req, res) {
  try {
    const fullName = String(req.body?.fullName ?? '').trim();
    const email = normalizeEmail(req.body?.email);
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

    const existingAccount = await accountModel.findByEmail(email);
    if (existingAccount) return reply(res, 409, { message: MSG.emailTaken });

    const pendingOtp = await authModel.findRegistrationOtpByEmail(email);
    if (pendingOtp) {
      const retryAfterSeconds = getRetryAfterSeconds(pendingOtp.last_sent_at);
      if (retryAfterSeconds > 0) {
        return reply(res, 429, {
          message: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã.`,
          retryAfterSeconds,
        });
      }
    }

    const otpValue = generateOtp();
    const otpHash = await bcrypt.hash(otpValue, BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);
    const lastSentAt = new Date();

    await authModel.upsertRegistrationOtp({
      email,
      passwordHash,
      fullName,
      otpHash,
      expiresAt,
      lastSentAt,
    });

    try {
      await sendRegisterOtpEmail(email, otpValue);
    } catch (mailError) {
      console.error('[auth.register.mail]', mailError?.message || mailError);
      if (mailFallbackToLog()) {
        console.warn(`[auth.register.otp-fallback] email=${email} otp=${otpValue}`);
        return reply(res, 200, {
          message: 'Mã xác minh đã được tạo (chưa gửi được email, xem log máy chủ).',
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
          mailSent: false,
        });
      }
      await authModel.deleteRegistrationOtp(email);
      return reply(res, 500, { message: MSG.mailFailed });
    }

    return reply(res, 200, {
      message: 'Đã gửi mã xác minh tới email của bạn.',
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
  } catch (error) {
    if (error?.code === '23505') return reply(res, 409, { message: MSG.emailTaken });
    console.error('[auth.register]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

async function verifyRegisterOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? '').trim();

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
      return reply(res, 400, { message: 'Email hoặc mã xác minh không hợp lệ.' });
    }

    const pendingOtp = await authModel.findRegistrationOtpByEmail(email);
    if (!pendingOtp) return reply(res, 400, { message: MSG.noPending });
    if (new Date(pendingOtp.expires_at).getTime() < Date.now()) {
      return reply(res, 400, { message: MSG.otpExpired });
    }

    const attemptsUsed = Number(pendingOtp.attempts ?? 0);
    if (attemptsUsed >= MAX_OTP_ATTEMPTS) return reply(res, 429, { message: MSG.otpTooMany });

    const isOtpValid = await bcrypt.compare(otp, pendingOtp.otp_hash);
    if (!isOtpValid) {
      const updatedRow = await authModel.incrementRegistrationOtpAttempts(email);
      const newAttempts = Number(updatedRow?.attempts ?? attemptsUsed + 1);
      const attemptsLeft = Math.max(0, MAX_OTP_ATTEMPTS - newAttempts);

      if (attemptsLeft <= 0) {
        return reply(res, 429, { message: MSG.otpTooMany });
      }

      return reply(res, 400, {
        message: MSG.otpWrong.replace('{n}', String(attemptsLeft)),
        attemptsLeft,
      });
    }

    const created = await accountModel.create({
      email,
      passwordHash: pendingOtp.password_hash,
      fullName: pendingOtp.full_name,
    });
    const account = await accountModel.findById(created.id);

    if (!account) return reply(res, 500, { message: MSG.server });

    await authModel.deleteRegistrationOtp(email);

    return reply(res, 200, {
      token: signToken({ accountId: account.id }),
      user: accountModel.toPublicAccount(account),
    });
  } catch (error) {
    if (error?.code === '23505') return reply(res, 409, { message: MSG.emailTaken });
    console.error('[auth.verifyRegisterOtp]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

async function resendRegisterOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!EMAIL_RE.test(email)) return reply(res, 400, { message: 'Email không hợp lệ.' });

    const pendingOtp = await authModel.findRegistrationOtpByEmail(email);
    if (!pendingOtp) return reply(res, 400, { message: MSG.noPending });

    const retryAfterSeconds = getRetryAfterSeconds(pendingOtp.last_sent_at);
    if (retryAfterSeconds > 0) {
      return reply(res, 429, {
        message: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã.`,
        retryAfterSeconds,
      });
    }

    const otpValue = generateOtp();
    const otpHash = await bcrypt.hash(otpValue, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);
    const lastSentAt = new Date();

    await authModel.refreshRegistrationOtp({ email, otpHash, expiresAt, lastSentAt });

    try {
      await sendRegisterOtpEmail(email, otpValue);
    } catch (mailError) {
      console.error('[auth.resendRegisterOtp.mail]', mailError?.message || mailError);
      if (mailFallbackToLog()) {
        console.warn(`[auth.resendRegisterOtp.otp-fallback] email=${email} otp=${otpValue}`);
        return reply(res, 200, {
          message: 'Mã xác minh mới đã được tạo (chưa gửi được email, xem log máy chủ).',
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
          mailSent: false,
        });
      }
      await authModel.deleteRegistrationOtp(email);
      return reply(res, 500, { message: MSG.mailFailed });
    }

    return reply(res, 200, {
      message: 'Đã gửi lại mã xác minh tới email của bạn.',
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
  } catch (error) {
    console.error('[auth.resendRegisterOtp]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/**
 * POST /api/auth/forgot-password — bước 1: nhận email, gửi OTP đặt lại mật khẩu.
 * Khác luồng đăng ký ở chỗ email PHẢI có trong bảng account:
 * không tồn tại → 404 "Email chưa được đăng ký." (yêu cầu nghiệp vụ của nhóm).
 */
async function forgotPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!EMAIL_RE.test(email)) return reply(res, 400, { message: 'Email không hợp lệ.' });

    const account = await accountModel.findByEmail(email);
    // Tài khoản đã xoá: coi như chưa đăng ký, không gửi mail cho hộp thư không còn dùng.
    if (!account || account.status === 'deleted') {
      return reply(res, 404, { message: MSG.emailNotRegistered });
    }

    const pendingOtp = await authModel.findPasswordResetOtpByEmail(email);
    if (pendingOtp) {
      const retryAfterSeconds = getRetryAfterSeconds(pendingOtp.last_sent_at);
      if (retryAfterSeconds > 0) {
        return reply(res, 429, {
          message: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã.`,
          retryAfterSeconds,
        });
      }
    }

    const otpValue = generateOtp();
    const otpHash = await bcrypt.hash(otpValue, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);
    const lastSentAt = new Date();

    await authModel.upsertPasswordResetOtp({ email, otpHash, expiresAt, lastSentAt });

    try {
      await sendPasswordResetOtpEmail(email, otpValue);
    } catch (mailError) {
      console.error('[auth.forgotPassword.mail]', mailError?.message || mailError);
      if (mailFallbackToLog()) {
        console.warn(`[auth.forgotPassword.otp-fallback] email=${email} otp=${otpValue}`);
        return reply(res, 200, {
          message: 'Mã xác minh đã được tạo (chưa gửi được email, xem log máy chủ).',
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
          mailSent: false,
        });
      }
      await authModel.deletePasswordResetOtp(email);
      return reply(res, 500, { message: MSG.mailFailed });
    }

    return reply(res, 200, {
      message: 'Đã gửi mã xác minh tới email của bạn.',
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
  } catch (error) {
    console.error('[auth.forgotPassword]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/**
 * POST /api/auth/forgot-password/verify — bước 2: kiểm tra OTP (giống verifyRegisterOtp)
 * nhưng KHÔNG đổi mật khẩu ngay: trả resetToken để bước 3 gửi mật khẩu mới.
 */
async function verifyResetOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? '').trim();

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
      return reply(res, 400, { message: 'Email hoặc mã xác minh không hợp lệ.' });
    }

    const pendingOtp = await authModel.findPasswordResetOtpByEmail(email);
    if (!pendingOtp) return reply(res, 400, { message: MSG.noResetRequest });
    if (new Date(pendingOtp.expires_at).getTime() < Date.now()) {
      return reply(res, 400, { message: MSG.otpExpired });
    }

    const attemptsUsed = Number(pendingOtp.attempts ?? 0);
    if (attemptsUsed >= MAX_OTP_ATTEMPTS) return reply(res, 429, { message: MSG.otpTooMany });

    const isOtpValid = await bcrypt.compare(otp, pendingOtp.otp_hash);
    if (!isOtpValid) {
      const updatedRow = await authModel.incrementPasswordResetOtpAttempts(email);
      const newAttempts = Number(updatedRow?.attempts ?? attemptsUsed + 1);
      const attemptsLeft = Math.max(0, MAX_OTP_ATTEMPTS - newAttempts);

      if (attemptsLeft <= 0) return reply(res, 429, { message: MSG.otpTooMany });

      return reply(res, 400, {
        message: MSG.otpWrong.replace('{n}', String(attemptsLeft)),
        attemptsLeft,
      });
    }

    const resetToken = generateResetToken();
    await authModel.setPasswordResetToken({
      email,
      tokenHash: hashResetToken(resetToken),
      tokenExpiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRES_MS),
    });

    return reply(res, 200, {
      message: 'Mã xác minh hợp lệ. Vui lòng đặt mật khẩu mới.',
      resetToken,
      email,
      expiresInSeconds: Math.floor(RESET_TOKEN_EXPIRES_MS / 1000),
    });
  } catch (error) {
    console.error('[auth.verifyResetOtp]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/**
 * POST /api/auth/forgot-password/reset — bước 3: đặt mật khẩu mới.
 * Cần resetToken do bước 2 cấp (không cho đổi mật khẩu chỉ với email).
 * Thành công → cập nhật DB, đăng nhập luôn (trả token + user) và xoá yêu cầu.
 */
async function resetPassword(req, res) {
  try {
    const resetToken = String(req.body?.resetToken ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!/^[a-f0-9]{64}$/.test(resetToken)) {
      return reply(res, 400, { message: MSG.resetSessionExpired });
    }
    if (password.length < 8 || password.length > 20) {
      return reply(res, 400, { message: 'Mật khẩu cần từ 8 đến 20 ký tự.' });
    }

    const resetRequest = await authModel.findPasswordResetByTokenHash(hashResetToken(resetToken));
    if (!resetRequest) return reply(res, 400, { message: MSG.resetSessionExpired });

    const email = normalizeEmail(resetRequest.email);
    if (password.toLowerCase() === email) {
      return reply(res, 400, { message: 'Mật khẩu không được trùng với email.' });
    }

    const account = await accountModel.findByEmail(email);
    if (!account || account.status === 'deleted') {
      await authModel.deletePasswordResetOtp(email);
      return reply(res, 404, { message: MSG.emailNotRegistered });
    }
    // Trạng thái tài khoản vẫn được kiểm như lúc đăng nhập: đổi được mật khẩu nhưng không vào được.
    if (account.status === 'locked') return reply(res, 403, { message: 'Tài khoản đã bị khoá.' });
    if (account.status === 'reported') return reply(res, 403, { message: 'Tài khoản đang bị hạn chế.' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await accountModel.updatePassword(account.id, passwordHash);
    await authModel.deletePasswordResetOtp(email);
    await accountModel.touchLastLogin(account.id);

    const updatedAccount = await accountModel.findById(account.id);
    if (!updatedAccount) return reply(res, 500, { message: MSG.server });

    return reply(res, 200, {
      message: 'Đặt lại mật khẩu thành công.',
      token: signToken({ accountId: updatedAccount.id }),
      user: accountModel.toPublicAccount(updatedAccount),
    });
  } catch (error) {
    console.error('[auth.resetPassword]', error);
    return reply(res, 500, { message: MSG.server });
  }
}

/** POST /api/auth/forgot-password/resend — gửi lại mã, dùng chung luật cooldown 60s */
async function resendResetOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!EMAIL_RE.test(email)) return reply(res, 400, { message: 'Email không hợp lệ.' });

    const pendingOtp = await authModel.findPasswordResetOtpByEmail(email);
    if (!pendingOtp) return reply(res, 400, { message: MSG.noResetRequest });

    const retryAfterSeconds = getRetryAfterSeconds(pendingOtp.last_sent_at);
    if (retryAfterSeconds > 0) {
      return reply(res, 429, {
        message: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã.`,
        retryAfterSeconds,
      });
    }

    const otpValue = generateOtp();
    const otpHash = await bcrypt.hash(otpValue, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);
    const lastSentAt = new Date();

    await authModel.refreshPasswordResetOtp({ email, otpHash, expiresAt, lastSentAt });

    try {
      await sendPasswordResetOtpEmail(email, otpValue);
    } catch (mailError) {
      console.error('[auth.resendResetOtp.mail]', mailError?.message || mailError);
      if (mailFallbackToLog()) {
        console.warn(`[auth.resendResetOtp.otp-fallback] email=${email} otp=${otpValue}`);
        return reply(res, 200, {
          message: 'Mã xác minh mới đã được tạo (chưa gửi được email, xem log máy chủ).',
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
          mailSent: false,
        });
      }
      await authModel.deletePasswordResetOtp(email);
      return reply(res, 500, { message: MSG.mailFailed });
    }

    return reply(res, 200, {
      message: 'Đã gửi lại mã xác minh tới email của bạn.',
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
  } catch (error) {
    console.error('[auth.resendResetOtp]', error);
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

module.exports = {
  register,
  verifyRegisterOtp,
  resendRegisterOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  resendResetOtp,
  login,
  getMe,
};