// Dữ liệu mẫu chỉ dùng cho trang Review Kit (lấy từ nội dung trong Figma).

export const MEALS = [
  {
    slot: 'breakfast', time: '07:00', kcal: 380, tag: 'Giàu vitamin', cookTime: '10 phút',
    title: 'Smoothie yến mạch, chuối, cải kale & bơ đậu phộng',
    description: 'Bổ sung vitamin A, C từ cải kale tươi cùng protein lành mạnh từ yến mạch.',
    macros: { protein: 14, carb: 52, fat: 12 },
  },
  {
    slot: 'lunch', time: '12:00', kcal: 620, tag: 'Cân bằng', cookTime: '40 phút',
    title: 'Cơm gạo lứt hạt sen, đậu hũ kho nấm & canh bí đỏ',
    description: 'Mâm cơm dưỡng sinh, cân bằng đạm thực vật từ đậu hũ và nấm rơm.',
    macros: { protein: 24, carb: 88, fat: 16 }, saved: true,
  },
  {
    slot: 'snack', time: '15:30', kcal: 260, tag: 'Chống oxy hoá', cookTime: '5 phút',
    title: 'Sữa hạt điều matcha & hạt óc chó nướng',
    description: 'Polyphenol từ trà xanh và axit béo omega thực vật từ óc chó.',
    macros: { protein: 8, carb: 22, fat: 17 },
  },
  {
    slot: 'dinner', time: '19:00', kcal: 540, tag: 'Giàu đạm thực vật', cookTime: '45 phút',
    title: 'Bún riêu chay sữa đậu nành & chả nấm thì là',
    description: 'Nước dùng chua thanh tự nhiên từ cà chua chín và me tươi.',
    macros: { protein: 22, carb: 78, fat: 8 }, isNew: true,
  },
];

export const NUTRITION_PARTS = [
  { key: 'protein', grams: 68, percent: 17 },
  { key: 'carb', grams: 240, percent: 52 },
  { key: 'fat', grams: 53, percent: 26 },
  { key: 'fiber', grams: 32, percent: 5 },
];

export const MACRO_TARGETS = [
  { key: 'protein', value: 68, target: 75 },
  { key: 'carb', value: 240, target: 260 },
  { key: 'fat', value: 53, target: 60 },
  { key: 'fiber', value: 32, target: 30 },
];

export const MICROS = [
  { name: 'Vitamin B12', short: 'B12', amount: '0,8 / 2,4 µg', status: 'lacking' },
  { name: 'Sắt', short: 'Fe', amount: '14 / 18 mg', status: 'low' },
  { name: 'Canxi', short: 'Ca', amount: '1.020 / 1.000 mg', status: 'enough' },
  { name: 'Omega-3 (ALA)', short: 'Ω3', amount: '1,7 / 1,6 g', status: 'enough' },
];

export const SHOPPING = [
  {
    title: 'Rau củ quả tươi', icon: 'flower3',
    items: [
      { id: 'kale', name: 'Cải kale', qty: '200 g', checked: true },
      { id: 'bido', name: 'Bí đỏ', qty: '500 g' },
      { id: 'cachua', name: 'Cà chua chín', qty: '4 quả' },
      { id: 'thila', name: 'Thì là', qty: '1 bó' },
    ],
  },
  {
    title: 'Đậu hũ & đồ lên men', icon: 'box-seam',
    items: [
      { id: 'dauhu', name: 'Đậu hũ non', qty: '2 miếng' },
      { id: 'suadau', name: 'Sữa đậu nành không đường', qty: '1 l', checked: true },
      { id: 'tuong', name: 'Tương miso', qty: '1 hũ' },
    ],
  },
];

export const PROMPTS = ['Món nào giàu B12?', 'Đổi bữa tối ít calo hơn', 'Gợi ý bữa sáng 10 phút'];

export const TOKEN_GROUPS = [
  {
    title: 'Nền – Theme A', note: 'Khoảng 90% giao diện',
    items: [
      ['--ac-moss', '#3D5A3D', 'Xanh rêu – màu chính'],
      ['--ac-matcha', '#7A9B6E', 'Xanh matcha – phụ'],
      ['--ac-cream', '#FBF7EE', 'Kem ngà – nền trang'],
      ['--ac-card', '#FFFDF8', 'Ngà nhạt – nền thẻ'],
      ['--ac-ink', '#2A2620', 'Nâu đen – chữ'],
      ['--ac-muted', '#6F675A', 'Nâu xám – chữ phụ'],
    ],
  },
  {
    title: 'Điểm nhấn – Theme C', note: 'Dưới 10%, tối đa 1 chỗ mỗi khu vực',
    items: [
      ['--ac-highlight', '#F9A620', 'Vàng cúc – chỉ làm nền'],
      ['--ac-alert', '#B7472A', 'Đất nung – cảnh báo'],
    ],
  },
  {
    title: 'Dữ liệu dinh dưỡng', note: 'Chỉ trong biểu đồ, gắn cố định với nhóm chất',
    items: [
      ['--ac-protein', '#1D7A4A', 'Đạm – xanh đậu'],
      ['--ac-carb', '#D4900A', 'Carbs – vàng nghệ'],
      ['--ac-fat', '#B7472A', 'Chất béo – đất nung'],
      ['--ac-fiber', '#7B4B94', 'Chất xơ – tím khoai lang'],
    ],
  },
];
