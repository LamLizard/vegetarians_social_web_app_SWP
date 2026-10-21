// =====================================================================
//  HẰNG SỐ NGHIỆP VỤ — nguồn chuẩn: Final Report v4.0 (theo ERD v4.1 CLEAN)
//
//  Key (bên trái) = đúng giá trị lưu trong database / trả về từ API.
//  → Backend trả `status: 'pending'` thì Frontend dùng thẳng, KHÔNG tự đặt tên khác.
//  label = chữ tiếng Việt hiển thị. Muốn đổi chữ chỉ sửa ở đây.
//
//  Chỗ tài liệu còn vênh: xem ghi chú "LƯU Ý" ở từng nhóm.
// =====================================================================

/** Tên app và tên trợ lý AI. Đổi ở đây là đổi toàn bộ giao diện. */
export const APP_NAME = 'Green Bowl';
export const APP_TAGLINE = 'Cộng đồng ăn chay, sống lành';
export const AI_NAME = 'Mầm';

/** Câu cảnh báo bắt buộc dưới mọi gợi ý của Meal Planner / Chatbot (BR-02). */
export const AI_DISCLAIMER = 'Gợi ý của Mầm chỉ để tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.';

/** Vai trò tài khoản. account.role */
export const ROLE = {
  member: 'Thành viên',
  admin: 'Quản trị viên',
};

/** Loại bài đăng. post.post_type */
export const POST_TYPE = {
  blog: { label: 'Blog', icon: 'journal-text' },
  video: { label: 'Video', icon: 'play-btn' },
};

/** Loại danh mục. category.category_type — Category thay cho Tag (BR-06). */
export const CATEGORY_TYPE = {
  dish_type: 'Loại món',
  recipe_type: 'Loại công thức',
};

/** Bữa ăn. meal_plan_item.meal_slot — mặc định 3 bữa/ngày, snack có thể thay 1 bữa. */
export const MEAL_SLOT = {
  breakfast: { label: 'Bữa sáng', icon: 'sunrise' },
  lunch: { label: 'Bữa trưa', icon: 'sun' },
  dinner: { label: 'Bữa tối', icon: 'moon-stars' },
  snack: { label: 'Bữa phụ', icon: 'cup-hot' },
};

/** Nhóm dinh dưỡng chính của 1 món trong thực đơn. meal_plan_item.nutrition_group
 *  LƯU Ý: lấy theo file ERD trong Project, chờ ERD v4.1 xác nhận. */
export const NUTRITION_GROUP = {
  protein:   { label: 'Giàu đạm',     icon: 'egg' },
  carb:      { label: 'Tinh bột',     icon: 'basket' },
  vegetable: { label: 'Rau củ',       icon: 'flower2' },
  fat:       { label: 'Chất béo tốt', icon: 'droplet' },
  fruit:     { label: 'Trái cây',     icon: 'apple' },
};

/** Nguồn tạo thực đơn. meal_plan.source (Report v4.0) */
export const MEAL_PLAN_SOURCE = {
  ai: 'Mầm gợi ý',
  manual: 'Tự lên',
};

/** Loại thông báo. notification.type
 *  8 giá trị đầu lấy từ file ERD trong Project. 4 giá trị cuối là GIẢ ĐỊNH theo Report v4.0
 *  (UC-03 "reject kèm Notification", Dish được duyệt) → Backend xác nhận tên trước khi dùng. */
export const NOTIFICATION_TYPE = {
  post_hidden:               { label: 'Bài bị ẩn',            icon: 'eye-slash',       tone: 'bad' },
  post_removed:              { label: 'Bài bị gỡ',            icon: 'trash3',          tone: 'bad' },
  comment_removed:           { label: 'Bình luận bị gỡ',      icon: 'chat-square-x',   tone: 'bad' },
  report_result:             { label: 'Kết quả báo cáo',      icon: 'flag',            tone: 'neutral' },
  account_locked:            { label: 'Tài khoản bị khoá',    icon: 'lock',            tone: 'bad' },
  shop_pending_verification: { label: 'Quán chờ xác minh',    icon: 'hourglass-split', tone: 'warn' },
  shop_verified:             { label: 'Quán đã xác minh',     icon: 'patch-check',     tone: 'ok' },
  shop_rejected:             { label: 'Quán bị từ chối',      icon: 'x-circle',        tone: 'bad' },
  post_approved:             { label: 'Bài được duyệt',       icon: 'check-circle',    tone: 'ok' },
  post_rejected:             { label: 'Bài bị từ chối',       icon: 'x-circle',        tone: 'bad' },
  dish_approved:             { label: 'Món được duyệt',       icon: 'check-circle',    tone: 'ok' },
  dish_rejected:             { label: 'Món bị từ chối',       icon: 'x-circle',        tone: 'bad' },
  ingredient_proposal_approved: { label: 'Nguyên liệu được duyệt', icon: 'check-circle', tone: 'ok' },
  ingredient_proposal_rejected: { label: 'Nguyên liệu bị từ chối', icon: 'x-circle', tone: 'bad' },
};

/** Mục tiêu sức khoẻ. profile.health_goal / meal_plan.goal_snapshot */
export const HEALTH_GOAL = {
  lose_weight: 'Giảm cân',
  gain_muscle: 'Tăng cơ',
  maintain: 'Giữ cân',
};

/** Mức vận động (dùng tính TDEE). profile.activity_level */
export const ACTIVITY_LEVEL = {
  sedentary: 'Ít vận động',
  light: 'Vận động nhẹ',
  moderate: 'Vận động vừa',
  active: 'Vận động nhiều',
};

/** Giới tính. profile.gender */
export const GENDER = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

/** Phân loại BMI (BR-03). profile.bmi_category */
export const BMI_CATEGORY = {
  underweight: 'Nhẹ cân',
  normal: 'Bình thường',
  overweight: 'Thừa cân',
  obese: 'Béo phì',
};

/** Dị ứng hay kiêng. allergy.kind */
export const ALLERGY_KIND = {
  allergy: 'Dị ứng',
  avoid: 'Kiêng',
};

/** Đối tượng bị báo cáo. report.target_type
 *  LƯU Ý: Report v4.0 có thêm `recipe` (FR-24), file ERD trong Project chỉ có post/comment. */
export const REPORT_TARGET = {
  post: 'Bài đăng',
  comment: 'Bình luận',
  recipe: 'Công thức',
};

/** Lý do báo cáo. report.reason_code */
export const REPORT_REASON = {
  spam: 'Spam, quảng cáo',
  wrong_topic: 'Sai chủ đề',
  not_vegan: 'Không phải món chay',
  abusive: 'Ngôn từ xúc phạm',
  other: 'Lý do khác',
};

const AUDIT_TARGET_LABEL = {
  post: 'bài viết',
  dish: 'món ăn',
  report: 'báo cáo',
  account: 'tài khoản',
  comment: 'bình luận',
  category: 'danh mục',
  banned_keyword: 'từ khoá vi phạm',
};

export function describeAuditAction(action, targetType) {
  const target = AUDIT_TARGET_LABEL[targetType] ?? String(targetType || '').replace(/_/g, ' ');
  const descriptions = {
    'APPROVE:post': 'Đã duyệt bài viết',
    'APPROVE:dish': 'Đã duyệt món ăn',
    'REJECT:post': 'Đã từ chối bài viết',
    'REJECT:report': 'Đã từ chối báo cáo',
    'RESTORE:post': 'Đã khôi phục bài viết',
    'REVIEW:post': 'Đã xem xét bài viết',
    'UPDATE:report': 'Đã xử lý báo cáo',
    'HIDE:banned_keyword': 'Đã ẩn từ khoá vi phạm',
    account_locked: 'Đã khoá tài khoản',
    account_unlocked: 'Đã mở khoá tài khoản',
    account_deleted: 'Đã xoá tài khoản',
    category_created: 'Đã tạo danh mục',
    category_renamed: 'Đã đổi tên danh mục',
    category_activated: 'Đã bật danh mục',
    category_deactivated: 'Đã tắt danh mục',
  };
  const key = `${action}:${targetType}`;
  if (descriptions[key]) return descriptions[key];
  if (descriptions[action]) return descriptions[action];
  if (action === 'APPROVE' || action === 'REJECT') {
    return `Đã ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} ${target || 'đối tượng'}`;
  }
  const normalized = String(action || '').replace(/_/g, ' ').toLocaleLowerCase('vi-VN');
  return normalized ? normalized[0].toLocaleUpperCase('vi-VN') + normalized.slice(1) : '—';
}

/** Người gửi tin nhắn chatbot. chat_message.sender */
export const CHAT_SENDER = {
  user: 'Bạn',
  bot: 'Trợ lý',
  system: 'Hệ thống',
};

/** BỘ ĐƠN VỊ NGUYÊN LIỆU CHUẨN (ô chọn UnitPicker — chỉ cho CHỌN, không gõ tự do; 20/10/2026).
 *  Server kiểm lại bằng server/src/utils/ingredientUnits.js; hai danh sách phải khớp (có test ingredientUnits.test.js).
 *  Cột recipe_ingredient.unit vẫn là chữ (VARCHAR 30) nên dữ liệu cũ có đơn vị lạ không bị mất.
 *  group = nhóm hiển thị · hint = chú thích dùng cho gì (Khoi's code 20/10/2026: cô góp ý đơn vị phải rõ ràng, không chung chung)
 *  noAmount = đơn vị không cần số lượng ("ít muối", "tiêu vừa đủ"). */
export const INGREDIENT_UNIT_GROUPS = [
  { key: 'weight', label: 'Khối lượng' },
  { key: 'volume', label: 'Thể tích' },
  { key: 'count', label: 'Đếm theo đơn vị' },
  { key: 'other', label: 'Khác' },
];
export const INGREDIENT_UNIT = [
  { value: 'g', group: 'weight', hint: 'gam' },
  { value: 'kg', group: 'weight', hint: 'ki-lô-gam (1 kg = 1000 g)' },
  { value: 'ml', group: 'volume', hint: 'mi-li-lít' },
  { value: 'lít', group: 'volume', hint: '1 lít = 1000 ml' },
  { value: 'muỗng canh', group: 'volume', hint: '≈ 15 ml' },
  { value: 'muỗng cà phê', group: 'volume', hint: '≈ 5 ml' },
  { value: 'chén', group: 'volume', hint: 'chén ăn cơm, ≈ 200 ml' },
  { value: 'cốc', group: 'volume', hint: '≈ 240 ml' },
  { value: 'củ', group: 'count', hint: 'cà rốt, khoai, củ cải…' },
  { value: 'quả', group: 'count', hint: 'cà chua, chanh, ớt…' },
  { value: 'tép', group: 'count', hint: 'tỏi' },
  { value: 'nhánh', group: 'count', hint: 'gừng, hành, rau thơm' },
  { value: 'lá', group: 'count', hint: 'lá chuối, lá lốt, rau…' },
  { value: 'lát', group: 'count', hint: 'cắt lát: gừng, bánh mì…' },
  { value: 'miếng', group: 'count', hint: 'đậu hũ, nấm, bánh…' },
  { value: 'bó', group: 'count', hint: 'rau cải, hành, ngò…' },
  { value: 'gói', group: 'count', hint: 'đóng gói sẵn' },
  { value: 'hộp', group: 'count', hint: 'đóng hộp sẵn' },
  { value: 'cái', group: 'count', hint: 'vật đếm được: bánh bao, bánh tráng…' },
  { value: 'ít', group: 'other', hint: 'nêm theo ý, không cần số lượng', noAmount: true },
  { value: 'vừa đủ', group: 'other', hint: 'không cần số lượng', noAmount: true },
];

/** Hạn mức cho khách (BR-04). */
export const GUEST_LIMIT = {
  postsPerDay: 3,
  chatTurnsPerDay: 3,
};

/** Tiện ích: biến object hằng số thành mảng { value, label } cho Select / Radio. */
export const toOptions = (map) =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === 'string' ? v : v.label }));
