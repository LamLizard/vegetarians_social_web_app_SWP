// Khoi's code (20/10/2026): BỘ ĐƠN VỊ NGUYÊN LIỆU CHUẨN — form Tạo công thức chỉ cho CHỌN, không cho gõ tự do.
// Nhờ vậy không có đơn vị lạ phải nhờ Admin duyệt, và cả app viết đơn vị giống nhau.
// PHẢI khớp INGREDIENT_UNIT ở client/src/constants/domain.js (ingredientUnits.test.js so hai danh sách).
// Muốn thêm/bớt đơn vị: sửa ở CẢ HAI chỗ rồi chạy `node --test src/utils/ingredientUnits.test.js`.
const UNITS = [
  'g', 'kg', 'ml', 'lít', 'muỗng canh', 'muỗng cà phê', 'chén', 'cốc',
  'củ', 'quả', 'tép', 'nhánh', 'lá', 'lát', 'miếng', 'bó', 'gói', 'hộp', 'cái',
  'ít', 'vừa đủ',
];
/** Đơn vị không cần số lượng ("ít muối", "tiêu vừa đủ") */
const NO_AMOUNT_UNITS = ['ít', 'vừa đủ'];

const key = (s) => String(s).normalize('NFC').trim().toLowerCase();
/** Tên chuẩn của đơn vị người dùng gửi ("Muỗng Canh" → "muỗng canh"); không có trong bộ chuẩn → null */
const canonicalUnit = (unit) => UNITS.find((u) => key(u) === key(unit)) ?? null;

module.exports = { UNITS, NO_AMOUNT_UNITS, canonicalUnit };
