// Duy's Code : Chuẩn hóa tên nguyên liệu tiếng Việt theo dạng Viết Hoa Từng Từ.
function formatIngredientName(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('vi')
    .replace(/(^|[\s\-'])\p{L}/gu, (letter) => letter.toLocaleUpperCase('vi'));
}

module.exports = { formatIngredientName };
