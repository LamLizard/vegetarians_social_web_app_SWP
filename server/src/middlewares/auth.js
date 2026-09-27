// server/src/middlewares/auth.js

const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const authModel = require('../models/auth.model');

const maximumDatabaseId = 9223372036854775807n;

/**
 * Tạo lỗi HTTP để chuyển cho error handler chung.
 */
function createAuthError(message, statusCode, code) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

/**
 * Kiểm tra ID tài khoản lấy từ JWT.
 *
 * Không chuyển ID sang Number vì PostgreSQL dùng BIGINT.
 */
function isValidAccountId(accountId) {
  if (
    typeof accountId !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(accountId)
  ) {
    return false;
  }

  return BigInt(accountId) <= maximumDatabaseId;
}

/**
 * Xác thực request.
 *
 * Frontend gửi header:
 * Authorization: Bearer <JWT>
 *
 * Sau khi xác thực thành công:
 * request.user chứa thông tin tài khoản.
 * request.auth chứa thông tin phiên.
 */
async function authenticate(request, response, next) {
  try {
    const authorizationHeader = request.get('Authorization');

    if (typeof authorizationHeader !== 'string') {
      throw createAuthError(
        'Vui lòng đăng nhập để tiếp tục.',
        401,
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Header phải có đúng dạng Bearer <token>.
    // Không phân biệt hoa/thường ở từ Bearer.
    const headerMatch = authorizationHeader.match(
      /^Bearer[ \t]+(\S+)$/i
    );

    if (headerMatch === null) {
      throw createAuthError(
        'Header xác thực không hợp lệ.',
        401,
        'INVALID_AUTHORIZATION_HEADER'
      );
    }

    const accessToken = headerMatch[1];
    const jwtSecret = process.env.JWT_SECRET;

    // Thiếu secret là lỗi cấu hình server, không phải lỗi người dùng.
    if (
      typeof jwtSecret !== 'string' ||
      jwtSecret.trim().length === 0
    ) {
      throw createAuthError(
        'Máy chủ chưa được cấu hình xác thực.',
        500,
        'AUTH_CONFIGURATION_ERROR'
      );
    }

    let tokenPayload;

    try {
      // verify kiểm tra chữ ký và thời hạn exp nếu token có exp.
      // Giới hạn thuật toán để chỉ chấp nhận HS256.
      tokenPayload = jwt.verify(accessToken, jwtSecret, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw createAuthError(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          401,
          'TOKEN_EXPIRED'
        );
      }

      if (
        error.name === 'JsonWebTokenError' ||
        error.name === 'NotBeforeError'
      ) {
        throw createAuthError(
          'Token không hợp lệ.',
          401,
          'INVALID_TOKEN'
        );
      }

      // Các lỗi khác được chuyển cho error handler.
      throw error;
    }

    // Không chấp nhận payload dạng chuỗi hoặc thiếu ID/thời hạn.
    if (
      tokenPayload === null ||
      typeof tokenPayload !== 'object' ||
      !isValidAccountId(tokenPayload.sub) ||
      !Number.isSafeInteger(tokenPayload.exp) ||
      tokenPayload.exp <= 0
    ) {
      throw createAuthError(
        'Thông tin trong token không hợp lệ.',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    // Hash token để đối chiếu với phiên trong database.
    // Không lưu hoặc ghi log JWT nguyên bản.
    const tokenHash = createHash('sha256')
      .update(accessToken, 'utf8')
      .digest('hex');

    const session = await authModel.findActiveSessionByTokenHash(
      tokenHash
    );

    if (session === null) {
      throw createAuthError(
        'Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.',
        401,
        'SESSION_INVALID'
      );
    }

    const accountId = String(session.account_id);

    // Đảm bảo tài khoản trong JWT khớp với chủ phiên trong DB.
    if (tokenPayload.sub !== accountId) {
      throw createAuthError(
        'Thông tin phiên đăng nhập không hợp lệ.',
        401,
        'SESSION_ACCOUNT_MISMATCH'
      );
    }

    // Chính sách đề xuất: chỉ tài khoản active được dùng API bảo vệ.
    if (session.account_status !== 'active') {
      throw createAuthError(
        'Tài khoản hiện không được phép thực hiện thao tác.',
        403,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    // Controller dùng request.user.accountId.
    // Role lấy từ DB, không tin role do frontend hoặc JWT cung cấp.
    request.user = {
      accountId,
      fullName: session.full_name,
      role: session.role_name,
      status: session.account_status,
    };

    request.auth = {
      sessionId: session.session_id,
      expiresAt: session.expires_at,
    };

    // Xác thực thành công, chuyển sang middleware tiếp theo.
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Chỉ cho phép Admin truy cập.
 * Phải đặt sau authenticate trong route.
 */
function requireAdmin(request, response, next) {
  if (request.user === undefined || request.user === null) {
    return next(
      createAuthError(
        'Vui lòng đăng nhập để tiếp tục.',
        401,
        'AUTHENTICATION_REQUIRED'
      )
    );
  }

  if (request.user.role !== 'admin') {
    return next(
      createAuthError(
        'Bạn không có quyền truy cập chức năng quản trị.',
        403,
        'ADMIN_PERMISSION_REQUIRED'
      )
    );
  }

  return next();
}

module.exports = {
  authenticate,
  requireAdmin,
};