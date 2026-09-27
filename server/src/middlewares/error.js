// server/src/middlewares/error.js

/**
 * Error handler của Express phải có đủ 4 tham số.
 * Vì vậy vẫn giữ next dù chỉ dùng khi response đã gửi header.
 */
function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Máy chủ gặp lỗi. Vui lòng thử lại sau.';

  // Chỉ công khai thông báo của lỗi 4xx do ứng dụng chủ động tạo.
  // Lỗi SQL hoặc lỗi nội bộ không được trả nguyên văn cho frontend.
  if (
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    statusCode = error.statusCode;
    message = error.message;

    if (typeof error.code === 'string') {
      errorCode = error.code;
    }
  }

  // express.json() chuyển lỗi JSON sai cú pháp đến đây.
  if (
    error.type === 'entity.parse.failed' &&
    error.status === 400
  ) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Body không đúng định dạng JSON.';
  }

  // Body vượt giới hạn cấu hình trong express.json().
  if (
    error.type === 'entity.too.large' &&
    error.status === 413
  ) {
    statusCode = 413;
    errorCode = 'REQUEST_BODY_TOO_LARGE';
    message = 'Dữ liệu gửi lên vượt quá giới hạn cho phép.';
  }

  if (statusCode >= 500) {
    // Chỉ log thông tin cơ bản, không log token, body hoặc lỗi SQL thô.
    console.error('Lỗi xử lý request:', {
      method: request.method,
      path: request.path,
      errorName: error.name,
    });
  }

  return response.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
    },
  });
}

module.exports = errorHandler;