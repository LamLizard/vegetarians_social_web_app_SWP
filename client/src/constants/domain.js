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
export const APP_NAME = 'Ăn Chay';
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

/** Người gửi tin nhắn chatbot. chat_message.sender */
export const CHAT_SENDER = {
  user: 'Bạn',
  bot: 'Trợ lý',
  system: 'Hệ thống',
};

/** Đơn vị nguyên liệu gợi ý. recipe_ingredient.unit là chữ tự do (VARCHAR),
 *  danh sách này chỉ để gợi ý cho thống nhất; người dùng vẫn gõ được đơn vị khác.
 *  noAmount = đơn vị không cần số lượng ("ít muối", "tiêu vừa đủ"). */
export const INGREDIENT_UNIT = [
  { value: 'g' }, { value: 'kg' }, { value: 'ml' }, { value: 'lít' },
  { value: 'muỗng canh' }, { value: 'muỗng cà phê' }, { value: 'chén' }, { value: 'cốc' },
  { value: 'cái' }, { value: 'quả' }, { value: 'củ' }, { value: 'lát' }, { value: 'miếng' },
  { value: 'bó' }, { value: 'nhánh' }, { value: 'gói' }, { value: 'hộp' },
  { value: 'ít', noAmount: true }, { value: 'vừa đủ', noAmount: true },
];

/** Hạn mức cho khách (BR-04). */
export const GUEST_LIMIT = {
  postsPerDay: 3,
  chatTurnsPerDay: 3,
};

/** Tiện ích: biến object hằng số thành mảng { value, label } cho Select / Radio. */
export const toOptions = (map) =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === 'string' ? v : v.label }));
