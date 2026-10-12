// Duy's code: Chuẩn hóa dữ liệu Dish và chuyển lỗi nhập liệu thành HTTP 400.
class DishInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DishInputError';
    this.status = 400;
  }
}

// Duy's code: Làm sạch và kiểm tra tên, mô tả, ảnh HTTPS và danh mục trước khi lưu.
function normalizeDishInput(body) {
  // Duy's code: Chuẩn hóa Unicode, khoảng trắng và giá trị tùy chọn trước khi kiểm tra.
  const name = String(body?.name ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  const description = String(body?.description ?? '').normalize('NFC').trim();
  const thumbnailUrl = String(body?.thumbnailUrl ?? '').trim() || null;
  const rawCategoryIds = body?.categoryIds;

  // Duy's code: Bắt buộc tên hợp lệ và giới hạn độ dài theo schema Dish.
  if (!name || [...name].length > 200) {
    throw new DishInputError('Tên món ăn là bắt buộc và không được vượt quá 200 ký tự.');
  }
  // Duy's code: Không cho mô tả vượt quá 500 ký tự trong schema.
  if ([...description].length > 500) {
    throw new DishInputError('Mô tả không được vượt quá 500 ký tự.');
  }
  if (thumbnailUrl) {
    try {
      // Duy's code: Chỉ nhận URL ảnh HTTPS và giới hạn độ dài trước khi lưu.
      if (new URL(thumbnailUrl).protocol !== 'https:' || thumbnailUrl.length > 500) {
        throw new Error('invalid');
      }
    } catch {
      throw new DishInputError('Ảnh đại diện món ăn phải là URL HTTPS hợp lệ, tối đa 500 ký tự.');
    }
  }
  // Duy's code: Yêu cầu tối thiểu một danh mục và chặn số lượng quá lớn.
  if (!Array.isArray(rawCategoryIds) || !rawCategoryIds.length || rawCategoryIds.length > 20) {
    throw new DishInputError('Vui lòng chọn từ 1 đến 20 danh mục.');
  }

  // Duy's code: Chuẩn hóa ID về số và loại bỏ danh mục bị chọn lặp.
  const categoryIds = [...new Set(rawCategoryIds.map(Number))];
  if (categoryIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new DishInputError('Danh mục được chọn không hợp lệ.');
  }

  // Duy's code: Trả dữ liệu đã chuẩn hóa để model lưu nhất quán.
  return { name, description: description || null, thumbnailUrl, categoryIds };
}

// Duy's code: Ánh xạ lựa chọn Admin sang trạng thái, log và notification thống nhất.
function getDishDecision(action) {
  if (action === 'approve') {
    return {
      status: 'active',
      logAction: 'dish_approved',
      notificationType: 'dish_approved',
      notificationTitle: 'Món ăn đã được duyệt',
    };
  }
  if (action === 'reject') {
    return {
      status: 'rejected',
      logAction: 'dish_rejected',
      notificationType: 'dish_rejected',
      notificationTitle: 'Đề xuất món ăn bị từ chối',
    };
  }
  throw new DishInputError('Quyết định duyệt món ăn không hợp lệ.');
}

module.exports = { DishInputError, getDishDecision, normalizeDishInput };
