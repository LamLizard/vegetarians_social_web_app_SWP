// Tùng — Sprint 2: menu riêng của Shop, không nhận trạng thái/Dish mới từ client.
const { whitelist, parseId, invalid } = require('./shopWorkflow');
const { parseSchedule } = require('./shopRegistration');
const { parseShopImageUrl } = require('./shopImageUpload');

function menuNameKey(value) {
  return value.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

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
  whitelist(value, creating ? ['dishId', 'displayName', 'imageUrl', 'price', 'ingredientNote', 'isAvailable']
    : ['displayName', 'imageUrl', 'price', 'ingredientNote', 'isAvailable', 'expectedVersion']);
  const result = creating ? { dishId: parseId(value.dishId, 'dishId') }
    : { expectedVersion: parseId(value.expectedVersion, 'expectedVersion') };
  if (creating || Object.hasOwn(value, 'displayName')) {
    if (typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.includes('\0')) invalid('displayName', 'Nhập tên món của quán.');
    const name = value.displayName.trim().normalize('NFC');
    if (Array.from(name).length > 100) invalid('displayName', 'Tên món tối đa 100 ký tự.');
    result.displayName = name;
  }
  if (creating || Object.hasOwn(value, 'imageUrl')) {
    if ((value.imageUrl === undefined && creating) || value.imageUrl === null) result.imageUrl = null;
    else {
      try { result.imageUrl = parseShopImageUrl(value.imageUrl).url; }
      catch { invalid('imageUrl', 'Chọn ảnh JPG, PNG hoặc WEBP được tải lên từ form này.'); }
    }
  }
  if (creating || Object.hasOwn(value, 'price')) result.price = parsePrice(value.price);
  if (Object.hasOwn(value, 'ingredientNote')) {
    if (typeof value.ingredientNote !== 'string' || value.ingredientNote.includes('\0')) invalid('ingredientNote', 'Ghi chú không hợp lệ.');
    if (Array.from(value.ingredientNote.trim()).length > 500) invalid('ingredientNote', 'Ghi chú tối đa 500 ký tự.');
    result.ingredientNote = value.ingredientNote.trim() || null;
  }
  if (Object.hasOwn(value, 'isAvailable')) {
    if (typeof value.isAvailable !== 'boolean') invalid('isAvailable', 'Trạng thái đang bán không hợp lệ.');
    result.isAvailable = value.isAvailable;
  }
  if (!creating && Object.keys(result).length === 1) invalid('body', 'Chưa có thay đổi menu để lưu.');
  return result;
}

function parseMenuRemoval(value) {
  whitelist(value, ['expectedVersion']);
  return { expectedVersion: parseId(value.expectedVersion, 'expectedVersion') };
}

const SEARCH_GROUPS = [
  ['a', 'àáảãạăằắẳẵặâầấẩẫậ'], ['e', 'èéẻẽẹêềếểễệ'], ['i', 'ìíỉĩị'],
  ['o', 'òóỏõọôồốổỗộơờớởỡợ'], ['u', 'ùúủũụưừứửữự'], ['y', 'ỳýỷỹỵ'], ['d', 'đ'],
];
// translate bỏ combining marks vì các ký tự cuối không có vị trí tương ứng ở chuỗi TO.
const DISH_SEARCH_FROM = SEARCH_GROUPS.map(([, letters]) => letters + letters.toUpperCase()).join('')
  + Array.from({ length: 0x70 }, (_, index) => String.fromCharCode(0x0300 + index)).join('');
const DISH_SEARCH_TO = SEARCH_GROUPS.map(([letter, letters]) => letter.repeat(Array.from(letters).length * 2)).join('');

function parseDishSearch(raw) {
  if (raw === undefined) return '';
  if (typeof raw !== 'string' || raw.includes('\0') || Array.from(raw).length > 200) invalid('q', 'Từ khóa tìm món tối đa 200 ký tự.');
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

module.exports = { parsePrice, parseScheduleUpdate, parseMenu, parseMenuRemoval, parseDishSearch, menuNameKey, DISH_SEARCH_FROM, DISH_SEARCH_TO };
