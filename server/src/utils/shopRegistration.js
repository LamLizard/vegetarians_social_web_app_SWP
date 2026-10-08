// Tùng — Sprint 2: validate thông tin đăng ký và lịch canonical, không phụ thuộc DB.
const { invalid, whitelist, text } = require('./shopWorkflow');

function parsePhone(value) {
  if (typeof value !== 'string') invalid('phone', 'Vui lòng nhập số điện thoại Việt Nam.');
  let phone = value.trim().replace(/[\s.()\-]/g, '');
  phone = phone.replace(/^(?:\+84|0084)/, '0');
  if (!/^0(?:[35789]\d{8}|2\d{9})$/.test(phone)) invalid('phone', 'Số điện thoại Việt Nam không hợp lệ.');
  return phone;
}

function parseIdentity(value) {
  whitelist(value, ['name', 'address', 'phone']);
  if (!Object.keys(value).length) invalid('body', 'Vui lòng nhập thông tin cần sửa.');
  const result = {};
  if (Object.hasOwn(value, 'name')) result.name = text(value.name, 'name', 200);
  if (Object.hasOwn(value, 'address')) result.address = text(value.address, 'address', 300);
  if (Object.hasOwn(value, 'phone')) result.phone = parsePhone(value.phone);
  return result;
}

function parseSchedule(value) {
  if (!Array.isArray(value) || value.length !== 7) invalid('schedule', 'Lịch phải có đủ bảy ngày trong tuần.');
  const seen = new Set();
  const result = value.map(day => {
    whitelist(day, ['dayOfWeek', 'isClosed', 'openTime', 'closeTime']);
    const field = `schedule.${day.dayOfWeek}`;
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7 || seen.has(day.dayOfWeek)) {
      invalid('schedule', 'Ngày trong tuần bị thiếu, trùng hoặc không hợp lệ.');
    }
    seen.add(day.dayOfWeek);
    if (typeof day.isClosed !== 'boolean') invalid(field, 'Vui lòng chọn mở cửa hoặc nghỉ.');
    if (day.isClosed) {
      if ([day.openTime, day.closeTime].some(time => time !== null && time !== undefined && time !== '')) {
        invalid(field, 'Ngày nghỉ không có giờ mở/đóng cửa.');
      }
      return { dayOfWeek: day.dayOfWeek, isClosed: true, openTime: null, closeTime: null };
    }
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (typeof day.openTime !== 'string' || typeof day.closeTime !== 'string'
      || !timePattern.test(day.openTime) || !timePattern.test(day.closeTime) || day.closeTime <= day.openTime) {
      invalid(field, 'Chọn đủ giờ HH:mm; giờ đóng phải sau giờ mở trong cùng ngày.');
    }
    return { dayOfWeek: day.dayOfWeek, isClosed: false, openTime: day.openTime, closeTime: day.closeTime };
  });
  if (result.every(day => day.isClosed)) invalid('schedule', 'Quán phải mở cửa ít nhất một ngày.');
  return result.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function parseRegistration(value) {
  whitelist(value, ['name', 'address', 'phone', 'schedule']);
  return { name: text(value.name, 'name', 200), address: text(value.address, 'address', 300),
    phone: parsePhone(value.phone), schedule: parseSchedule(value.schedule) };
}

module.exports = { parsePhone, parseIdentity, parseSchedule, parseRegistration };
