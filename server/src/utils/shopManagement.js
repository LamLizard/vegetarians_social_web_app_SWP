// Tùng — Sprint 2: menu riêng của Shop, không nhận trạng thái/Dish mới từ client.
const { whitelist, parseId, invalid } = require('./shopWorkflow');
const { parseSchedule } = require('./shopRegistration');

function parsePrice(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 99999999) {
    invalid('price', 'Giá phải là số nguyên VNĐ từ 0 đến 99.999.999.');
  }
  return value;
}

function parseScheduleUpdate(value) {
  whitelist(value, ['schedule', 'expectedVersion']);
  return { schedule: parseSchedule(value.schedule), expectedVersion: parseId(value.expectedVersion, 'expectedVersion') };
}

function parseMenu(value, creating = false) {
  whitelist(value, creating ? ['dishId', 'price', 'ingredientNote', 'isAvailable']
    : ['price', 'ingredientNote', 'isAvailable', 'expectedVersion']);
  const result = creating ? { dishId: parseId(value.dishId, 'dishId') }
    : { expectedVersion: parseId(value.expectedVersion, 'expectedVersion') };
  if (creating || Object.hasOwn(value, 'price')) result.price = parsePrice(value.price);
  if (Object.hasOwn(value, 'ingredientNote')) {
    if (typeof value.ingredientNote !== 'string' || value.ingredientNote.includes('\0')) invalid('ingredientNote', 'Ghi chú không hợp lệ.');
    result.ingredientNote = value.ingredientNote.trim() || null;
  }
  if (Object.hasOwn(value, 'isAvailable')) {
    if (typeof value.isAvailable !== 'boolean') invalid('isAvailable', 'Trạng thái đang bán không hợp lệ.');
    result.isAvailable = value.isAvailable;
  }
  if (!creating && Object.keys(result).length === 1) invalid('body', 'Chưa có thay đổi menu để lưu.');
  return result;
}

module.exports = { parsePrice, parseScheduleUpdate, parseMenu };
