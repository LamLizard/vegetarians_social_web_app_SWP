// server/src/controllers/shop.controller.js

const shopModel = require('../models/shop.model');

// ID trong PostgreSQL dùng BIGINT có dấu.
// Giữ ID dưới dạng chuỗi để tránh mất độ chính xác khi dùng Number.
const maximumDatabaseId = 9223372036854775807n;

/**
 * Tạo lỗi để chuyển sang error handler chung.
 */
function createControllerError(message, statusCode, code) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

/**
 * Kiểm tra ID:
 * - Phải là chuỗi chứa số nguyên dương.
 * - Không vượt giới hạn BIGINT của PostgreSQL.
 *
 * Trả lại chuỗi ID hợp lệ, không chuyển sang Number.
 */
function validateDatabaseId(value, fieldName) {
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(value)
  ) {
    throw createControllerError(
      `${fieldName} phải là số nguyên dương hợp lệ.`,
      400,
      'INVALID_DATABASE_ID'
    );
  }

  if (BigInt(value) > maximumDatabaseId) {
    throw createControllerError(
      `${fieldName} vượt quá giới hạn cho phép.`,
      400,
      'INVALID_DATABASE_ID'
    );
  }

  return value;
}

/**
 * Đọc số nguyên dương từ query string.
 *
 * Query string là chuỗi:
 * Ví dụ ?page=2 thì request.query.page là "2".
 *
 * Nếu không truyền, sử dụng giá trị mặc định.
 */
function parsePositiveInteger(
  value,
  fieldName,
  defaultValue,
  maximumValue
) {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]*$/.test(value)
  ) {
    throw createControllerError(
      `${fieldName} phải là số nguyên dương.`,
      400,
      'INVALID_PAGINATION'
    );
  }

  const parsedValue = Number(value);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue > maximumValue
  ) {
    throw createControllerError(
      `${fieldName} không được vượt quá ${maximumValue}.`,
      400,
      'INVALID_PAGINATION'
    );
  }

  return parsedValue;
}

/**
 * GET /api/admin/shops
 *
 * Ví dụ:
 * /api/admin/shops?verificationStatus=pending&search=Chay&page=1&limit=10
 */
async function getShopsForVerification(request, response, next) {
  try {
    const allowedStatuses = ['pending', 'verified', 'rejected'];

    // Chỉ mặc định khi không truyền tham số.
    // Nếu truyền giá trị rỗng hoặc sai thì trả lỗi.
    let verificationStatus = 'pending';

    if (request.query.verificationStatus !== undefined) {
      verificationStatus = request.query.verificationStatus;
    }

    if (
      typeof verificationStatus !== 'string' ||
      !allowedStatuses.includes(verificationStatus)
    ) {
      throw createControllerError(
        'Trạng thái lọc phải là pending, verified hoặc rejected.',
        400,
        'INVALID_VERIFICATION_STATUS'
      );
    }

    let search = '';

    if (request.query.search !== undefined) {
      if (typeof request.query.search !== 'string') {
        throw createControllerError(
          'Từ khóa tìm kiếm phải là chuỗi.',
          400,
          'INVALID_SEARCH'
        );
      }

      search = request.query.search.trim();
    }

    // Tên quán có giới hạn 200 ký tự theo schema.
    if (Array.from(search).length > 200) {
      throw createControllerError(
        'Từ khóa tìm kiếm không được vượt quá 200 ký tự.',
        400,
        'SEARCH_TOO_LONG'
      );
    }

    const page = parsePositiveInteger(
      request.query.page,
      'page',
      1,
      Number.MAX_SAFE_INTEGER
    );

    const limit = parsePositiveInteger(
      request.query.limit,
      'limit',
      10,
      100
    );

    // Model tính offset = (page - 1) * limit.
    // Kiểm tra để phép tính không vượt giới hạn chính xác của Number.
    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      throw createControllerError(
        'Số trang vượt quá giới hạn cho phép.',
        400,
        'INVALID_PAGINATION'
      );
    }

    const result = await shopModel.findShopsForVerification({
      verificationStatus,
      search,
      page,
      limit,
    });

    return response.status(200).json({
      success: true,
      message: 'Lấy danh sách quán thành công.',
      data: result.shops,
      pagination: result.pagination,
    });
  } catch (error) {
    // Chuyển lỗi cho error handler.
    // Không trả trực tiếp lỗi SQL ra frontend.
    return next(error);
  }
}

/**
 * GET /api/admin/shops/:shopId
 */
async function getShopById(request, response, next) {
  try {
    const shopId = validateDatabaseId(
      request.params.shopId,
      'shopId'
    );

    const shop = await shopModel.findShopById(shopId);

    if (shop === null) {
      throw createControllerError(
        'Không tìm thấy quán.',
        404,
        'SHOP_NOT_FOUND'
      );
    }

    return response.status(200).json({
      success: true,
      message: 'Lấy thông tin quán thành công.',
      data: shop,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/admin/shops/:shopId/verification
 *
 * Body xác minh:
 * {
 *   "verificationStatus": "verified"
 * }
 *
 * Body từ chối:
 * {
 *   "verificationStatus": "rejected",
 *   "verificationNote": "Thông tin địa chỉ chưa đầy đủ."
 * }
 */
async function updateShopVerification(request, response, next) {
  try {
    const shopId = validateDatabaseId(
      request.params.shopId,
      'shopId'
    );

    // request.user được middleware xác thực tạo ra.
    // Người dùng không thể chọn Admin thực hiện bằng cách gửi body.
    if (
      request.user === undefined ||
      request.user === null ||
      request.user.accountId === undefined ||
      request.user.accountId === null
    ) {
      throw createControllerError(
        'Vui lòng đăng nhập để thực hiện thao tác.',
        401,
        'AUTHENTICATION_REQUIRED'
      );
    }

    // Middleware sẽ cung cấp accountId dưới dạng chuỗi,
    // lấy từ tài khoản đã được xác thực.
    const adminId = validateDatabaseId(
      request.user.accountId,
      'accountId'
    );

    const requestBody = request.body;

    // Không chấp nhận body thiếu, null hoặc một mảng.
    if (
      requestBody === null ||
      typeof requestBody !== 'object' ||
      Array.isArray(requestBody)
    ) {
      throw createControllerError(
        'Body phải là một object JSON hợp lệ.',
        400,
        'INVALID_REQUEST_BODY'
      );
    }

    const verificationStatus = requestBody.verificationStatus;
    const allowedStatuses = ['verified', 'rejected'];

    if (
      typeof verificationStatus !== 'string' ||
      !allowedStatuses.includes(verificationStatus)
    ) {
      throw createControllerError(
        'Kết quả xác minh phải là verified hoặc rejected.',
        400,
        'INVALID_VERIFICATION_STATUS'
      );
    }

    let verificationNote = '';

    if (requestBody.verificationNote !== undefined) {
      if (typeof requestBody.verificationNote !== 'string') {
        throw createControllerError(
          'Ghi chú xác minh phải là chuỗi.',
          400,
          'INVALID_VERIFICATION_NOTE'
        );
      }

      verificationNote = requestBody.verificationNote.trim();
    }

    if (
      verificationStatus === 'rejected' &&
      verificationNote.length === 0
    ) {
      throw createControllerError(
        'Vui lòng nhập lý do từ chối.',
        400,
        'REJECTION_REASON_REQUIRED'
      );
    }

    if (Array.from(verificationNote).length > 255) {
      throw createControllerError(
        'Ghi chú xác minh không được vượt quá 255 ký tự.',
        400,
        'VERIFICATION_NOTE_TOO_LONG'
      );
    }

    // Dùng IP do Express cung cấp.
    // Không tự lấy IP từ body hoặc header do client gửi.
    // Nếu triển khai qua proxy, team cần cấu hình trust proxy phù hợp.
    let ipAddress = null;

    if (typeof request.ip === 'string') {
      ipAddress = request.ip;
    }

    const updatedShop = await shopModel.updateShopVerification({
      shopId,
      adminId,
      verificationStatus,
      verificationNote,
      ipAddress,
    });

    let successMessage;

    if (verificationStatus === 'verified') {
      successMessage = 'Xác minh quán thành công.';
    } else {
      successMessage = 'Đã từ chối đăng ký quán.';
    }

    return response.status(200).json({
      success: true,
      message: successMessage,
      data: updatedShop,
    });
  } catch (error) {
    return next(error);
  }
}

// Export object chứa các hàm xử lý của domain shop.
// Route sẽ sử dụng shopController.getShopById, ...
module.exports = {
  getShopsForVerification,
  getShopById,
  updateShopVerification,
};