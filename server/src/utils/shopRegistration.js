// Tùng — Sprint 2: validate thông tin đăng ký và lịch canonical, không phụ thuộc DB.
const { invalid, whitelist, text } = require('./shopWorkflow');

// Snapshot/current URL có thể đã tồn tại trước flow upload mới; chỉ verifier kiểm tra asset mới.
function parseAvtShopUrl(value) {
  if (typeof value !== 'string') invalid('avtShopUrl', 'Vui lòng tải ảnh quán.');
  const url = value.trim();
  let parsed;
  try { parsed = new URL(url); } catch { invalid('avtShopUrl', 'Đường dẫn ảnh quán không hợp lệ.'); }
  if (!/^https:\/\//i.test(url) || /[\u0000-\u0020\u007f]/.test(url) || url.includes('#') || url.includes('\\')
    || /^https:\/\/[^/?#]*@/i.test(url) || parsed.protocol !== 'https:'
    || !parsed.hostname || parsed.username || parsed.password) invalid('avtShopUrl', 'Đường dẫn ảnh quán không hợp lệ.');
  return url;
}

function parsePhone(value) {
  if (typeof value !== 'string') invalid('phone', 'Vui lòng nhập số điện thoại Việt Nam.');
  let phone = value.trim().replace(/[\s.()\-]/g, '');
  phone = phone.replace(/^(?:\+84|0084)/, '0');
  if (!/^0(?:[35789]\d{8}|2\d{9})$/.test(phone)) invalid('phone', 'Số điện thoại Việt Nam không hợp lệ.');
  return phone;
}

function parseIdentity(value) {
  whitelist(value, ['name', 'address', 'phone', 'avtShopUrl']);
  if (!Object.keys(value).length) invalid('body', 'Vui lòng nhập thông tin cần sửa.');
  const result = {};
  if (Object.hasOwn(value, 'name')) result.name = text(value.name, 'name', 200);
  if (Object.hasOwn(value, 'address')) result.address = text(value.address, 'address', 300);
  if (Object.hasOwn(value, 'phone')) result.phone = parsePhone(value.phone);
  if (Object.hasOwn(value, 'avtShopUrl')) result.avtShopUrl = parseAvtShopUrl(value.avtShopUrl);
  return result;
}

function parseSchedule(value) {
  if (!Array.isArray(value) || value.length !== 7) invalid('schedule', 'Lịch phải có đủ bảy ngày trong tuần.');
  const seen = new Set();
  const result = Array.from(value, day => {
    if (!day || typeof day !== 'object' || Array.isArray(day)) invalid('schedule', 'Ngày trong tuần không hợp lệ.');
    const field = `schedule.${day.dayOfWeek}`;
    const unknown = Object.keys(day).find(key => !['dayOfWeek', 'isClosed', 'slots'].includes(key));
    if (unknown) invalid(`${field}.${unknown}`, 'Trường dữ liệu không được phép gửi.');
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7 || seen.has(day.dayOfWeek)) {
      invalid('schedule', 'Ngày trong tuần bị thiếu, trùng hoặc không hợp lệ.');
    }
    seen.add(day.dayOfWeek);
    if (typeof day.isClosed !== 'boolean') invalid(`${field}.isClosed`, 'Vui lòng chọn mở cửa hoặc nghỉ.');
    if (!Array.isArray(day.slots)) invalid(`${field}.slots`, 'Vui lòng nhập các ca mở cửa.');
    if (day.isClosed) {
      if (day.slots.length) invalid(`${field}.slots`, 'Ngày nghỉ không có ca mở cửa.');
      return { dayOfWeek: day.dayOfWeek, isClosed: true, slots: [] };
    }
    if (!day.slots.length) invalid(`${field}.slots`, 'Ngày mở cửa phải có ít nhất một ca.');
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const slots = Array.from(day.slots, (slot, index) => {
      const slotField = `${field}.slots.${index}`;
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) invalid(slotField, 'Ca mở cửa không hợp lệ.');
      const extra = Object.keys(slot).find(key => !['openTime', 'closeTime'].includes(key));
      if (extra) invalid(`${slotField}.${extra}`, 'Trường dữ liệu không được phép gửi.');
      if (typeof slot.openTime !== 'string' || typeof slot.closeTime !== 'string'
        || !timePattern.test(slot.openTime) || !timePattern.test(slot.closeTime) || slot.closeTime <= slot.openTime) {
        invalid(slotField, 'Chọn đủ giờ HH:mm; giờ đóng phải sau giờ mở trong cùng ngày.');
      }
      return { openTime: slot.openTime, closeTime: slot.closeTime, index };
    }).sort((a, b) => a.openTime.localeCompare(b.openTime) || a.closeTime.localeCompare(b.closeTime));
    for (let index = 1; index < slots.length; index += 1) {
      if (slots[index].openTime < slots[index - 1].closeTime) {
        invalid(`${field}.slots.${slots[index].index}`, 'Các ca mở cửa không được chồng lấn.');
      }
    }
    return { dayOfWeek: day.dayOfWeek, isClosed: false,
      slots: slots.map(({ openTime, closeTime }) => ({ openTime, closeTime })) };
  });
  if (result.every(day => day.isClosed)) invalid('schedule', 'Quán phải mở cửa ít nhất một ngày.');
  return result.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function parseRegistration(value) {
  whitelist(value, ['name', 'address', 'phone', 'avtShopUrl', 'schedule']);
  const schedule = value.schedule === undefined || (Array.isArray(value.schedule) && !value.schedule.length)
    ? [] : parseSchedule(value.schedule);
  return { name: text(value.name, 'name', 200), address: text(value.address, 'address', 300),
    phone: parsePhone(value.phone), avtShopUrl: parseAvtShopUrl(value.avtShopUrl), schedule };
}

module.exports = { parsePhone, parseAvtShopUrl, parseIdentity, parseSchedule, parseRegistration };
