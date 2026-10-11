// =====================================================================
//  Khoi's code: Service trang Tạo công thức (Recipe) — CÁCH A: CHỈ DỮ LIỆU GIẢ
//
//  Nhóm chưa sửa DB (recipe.dish_id còn NOT NULL, chưa có status...) nên trang này
//  chưa gọi server. Dữ liệu giả lưu trong localStorage của trình duyệt để tải lại
//  trang vẫn thấy "Công thức đã gửi". Muốn làm sạch: gọi recipeService.resetMock().
//
//  Tên field theo ERD (snake_case) + các field ĐỀ XUẤT cho phương án B:
//    recipe.status              'pending' | 'approved' | 'rejected'   (GAP-01)
//    recipe.proposed_dish_name  tên món User đề xuất, khi dish_id = null
//    recipe.moderation_note     lý do Admin từ chối (prototype gọi là rejection_reason)
//    recipe.created_at
//  Khi có API thật: giữ nguyên tên hàm, thay phần thân bằng apiFetch (giống post.service.js).
// =====================================================================

const STORE_KEY = 'anchay-mock-my-recipes';
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

/** Bảng dish: chỉ 'active' mới hiện trong ô chọn món. 'pending' có trong DB nhưng User không thấy. */
const DISHES = [
  { dish_id: 1, name: 'Đậu hũ sốt cà chua', status: 'active' },
  { dish_id: 2, name: 'Đậu hũ chiên sả', status: 'active' },
  { dish_id: 3, name: 'Đậu hũ non hấp nấm', status: 'active' },
  { dish_id: 4, name: 'Canh rau củ', status: 'active' },
  { dish_id: 5, name: 'Canh chua chay', status: 'active' },
  { dish_id: 6, name: 'Phở chay', status: 'active' },
  { dish_id: 7, name: 'Bún riêu chay', status: 'active' },
  { dish_id: 8, name: 'Cơm chiên dương châu chay', status: 'active' },
  { dish_id: 9, name: 'Gỏi cuốn chay', status: 'active' },
  { dish_id: 10, name: 'Nấm kho tiêu', status: 'active' },
  { dish_id: 11, name: 'Mì xào rau củ', status: 'active' },
  { dish_id: 12, name: 'Chè đậu xanh', status: 'active' },
  { dish_id: 13, name: 'Buddha bowl đậu hũ', status: 'active' },
  { dish_id: 14, name: 'Bánh xèo chay', status: 'pending' },
];

/** Gợi ý tên nguyên liệu (ingredient.name) cho IngredientEditor. */
const INGREDIENT_NAMES = [
  'Đậu hũ', 'Cà chua', 'Nấm rơm', 'Nấm đông cô', 'Hành lá', 'Sả', 'Ớt', 'Tiêu',
  'Nước tương', 'Dầu ăn', 'Đường', 'Muối', 'Rau mùi', 'Cà rốt', 'Bắp cải', 'Giá đỗ',
];

/** Công thức mẫu của người đang đăng nhập — đủ 3 trạng thái để test tab "Công thức đã gửi". */
const SEED_MY_RECIPES = [
  {
    recipe_id: 31, title: 'Đậu hũ sốt cà kiểu nhà làm', dish_id: 1, dish_name: 'Đậu hũ sốt cà chua',
    proposed_dish_name: null, thumbnail_url: null, servings: 2, prep_time_minutes: 10, cook_time_minutes: 15,
    ingredient_count: 6, status: 'pending', moderation_note: null, created_at: '2026-10-11T07:40:00+07:00',
  },
  {
    recipe_id: 27, title: 'Bánh xèo chay giòn rụm', dish_id: null, dish_name: null,
    proposed_dish_name: 'Bánh xèo chay', thumbnail_url: null, servings: 4, prep_time_minutes: 30, cook_time_minutes: 20,
    ingredient_count: 9, status: 'pending', moderation_note: null, created_at: '2026-10-09T19:12:00+07:00',
  },
  {
    recipe_id: 22, title: 'Canh chua chay miền Tây', dish_id: 5, dish_name: 'Canh chua chay',
    proposed_dish_name: null, thumbnail_url: null, servings: 4, prep_time_minutes: 15, cook_time_minutes: 25,
    ingredient_count: 11, status: 'approved', moderation_note: null, created_at: '2026-10-02T11:05:00+07:00',
  },
  {
    recipe_id: 18, title: 'Nấm kho', dish_id: 10, dish_name: 'Nấm kho tiêu',
    proposed_dish_name: null, thumbnail_url: null, servings: null, prep_time_minutes: null, cook_time_minutes: null,
    ingredient_count: 2, status: 'rejected',
    moderation_note: 'Các bước nấu quá ngắn, chưa ghi thời gian kho và lượng nước. Bạn bổ sung rồi gửi lại nhé.',
    created_at: '2026-09-28T20:30:00+07:00',
  },
];

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* trình duyệt chặn localStorage hoặc dữ liệu hỏng → dùng bản mẫu */ }
  return SEED_MY_RECIPES;
};
const writeStore = (list) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* bỏ qua: chỉ mất khi tải lại trang */ }
};

const fail = (message) => { const e = new Error(message); e.status = 400; throw e; };

const recipeService = {
  /** Món đang active cho ô chọn món (BE thật: GET /dishes?status=active) */
  async getActiveDishes() {
    await wait();
    return { items: DISHES.filter((d) => d.status === 'active') };
  },

  /** Tên nguyên liệu gợi ý (BE thật: GET /ingredients) */
  async getIngredientNames() {
    return { items: INGREDIENT_NAMES };
  },

  /** Công thức của chính mình, mới nhất trước (BE thật: GET /recipes/mine) */
  async getMyRecipes() {
    await wait();
    const items = [...readStore()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { items };
  },

  /**
   * Gửi công thức → status 'pending', KHÔNG tạo Dish (món đề xuất chỉ là chữ gửi kèm).
   * Kiểm tra lại các luật như BE sẽ làm, để test được cả khi bỏ qua kiểm tra ở form.
   * @param {{dish:{type:'existing',dish}|{type:'proposed',name}, title, thumbnail_url, servings,
   *          prep_time_minutes, cook_time_minutes, ingredients:{name,amount,unit}[], instructions}} data
   */
  async createRecipe(data) {
    await wait(700);
    const title = (data.title ?? '').trim();
    const instructions = (data.instructions ?? '').trim();
    const ingredients = (data.ingredients ?? []).filter((i) => i.name?.trim());
    if (!data.dish) fail('Chọn hoặc đề xuất món ăn');
    if (data.dish.type === 'existing' && !DISHES.some((d) => d.dish_id === data.dish.dish.dish_id && d.status === 'active')) {
      fail('Món đã chọn không còn hoạt động, hãy chọn món khác');
    }
    if (data.dish.type === 'proposed' && !data.dish.name?.trim()) fail('Tên món đề xuất đang trống');
    if (!title) fail('Nhập tên công thức');
    if (title.length > 255) fail('Tên công thức tối đa 255 ký tự');
    if (!ingredients.some((i) => Number(i.amount) > 0)) fail('Cần ít nhất 1 nguyên liệu có số lượng');
    if (!instructions) fail('Cần ít nhất 1 bước nấu');

    const proposed = data.dish.type === 'proposed';
    const created = {
      recipe_id: Date.now(),
      title,
      dish_id: proposed ? null : data.dish.dish.dish_id,
      dish_name: proposed ? null : data.dish.dish.name,
      proposed_dish_name: proposed ? data.dish.name.trim().slice(0, 200) : null,
      thumbnail_url: data.thumbnail_url || null,
      servings: data.servings ?? null,
      prep_time_minutes: data.prep_time_minutes ?? null,
      cook_time_minutes: data.cook_time_minutes ?? null,
      ingredient_count: ingredients.length,
      instructions,
      status: 'pending',
      moderation_note: null,
      created_at: new Date().toISOString(),
    };
    writeStore([created, ...readStore()]);
    return created;
  },

  /** Xoá dữ liệu giả đã gửi, về lại 4 công thức mẫu (gọi trong Console khi test) */
  resetMock() {
    try { localStorage.removeItem(STORE_KEY); } catch { /* bỏ qua */ }
  },
};

export default recipeService;
