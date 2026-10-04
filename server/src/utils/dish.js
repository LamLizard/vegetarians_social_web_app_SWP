class DishInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DishInputError';
    this.status = 400;
  }
}

function normalizeDishInput(body) {
  const name = String(body?.name ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
  const description = String(body?.description ?? '').normalize('NFC').trim();
  const thumbnailUrl = String(body?.thumbnailUrl ?? '').trim() || null;
  const rawCategoryIds = body?.categoryIds;

  if (!name || [...name].length > 200) {
    throw new DishInputError('Tên món ăn là bắt buộc và không được vượt quá 200 ký tự.');
  }
  if ([...description].length > 500) {
    throw new DishInputError('Mô tả không được vượt quá 500 ký tự.');
  }
  if (thumbnailUrl) {
    try {
      if (new URL(thumbnailUrl).protocol !== 'https:' || thumbnailUrl.length > 500) {
        throw new Error('invalid');
      }
    } catch {
      throw new DishInputError('Ảnh đại diện món ăn phải là URL HTTPS hợp lệ, tối đa 500 ký tự.');
    }
  }
  if (!Array.isArray(rawCategoryIds) || !rawCategoryIds.length || rawCategoryIds.length > 20) {
    throw new DishInputError('Vui lòng chọn từ 1 đến 20 danh mục.');
  }

  const categoryIds = [...new Set(rawCategoryIds.map(Number))];
  if (categoryIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new DishInputError('Danh mục được chọn không hợp lệ.');
  }

  return { name, description: description || null, thumbnailUrl, categoryIds };
}

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
