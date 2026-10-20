// =====================================================================
//  Khoi's code: Service trang Tạo công thức (Recipe) — PHƯƠNG ÁN B: GỌI API THẬT (12/10/2026)
//  Server: server/src/routes/recipe.routes.js  (gắn ở /api/recipes)
//
//  MyRecipe (tab "Công thức đã gửi"):
//    { id, title, dishId, dishName, proposedDishName, thumbnailUrl, servings, prepTimeMinutes,
//      cookTimeMinutes, status: 'pending'|'approved'|'rejected', moderationNote, createdAt,
//      ingredientCount, proposedIngredientCount }
//  MyRecipeDetail (Khoi's code, mở lại form "Sửa và gửi lại"): MyRecipe + { instructions,
//      ingredients: [{ name, amount, unit, proposed }] }   proposed = nguyên liệu đề xuất, chưa có trong kho
//  IngredientCheck: { name, known, isAnimalDerived, keyword }
//    known = false  → chưa có trong kho nguyên liệu, gửi kèm công thức cho Admin duyệt
//    isAnimalDerived / keyword → nghi không chay: tô đỏ, KHÔNG chặn gửi (Admin xem lại)
// =====================================================================
import { apiFetch } from './api';

/** Form → body API: món có sẵn gửi dishId, món đề xuất gửi proposedDishName */
const toRecipeBody = ({ dish, ...rest }) => ({
  ...rest,
  ...(dish?.type === 'existing' ? { dishId: dish.dish.dish_id } : { proposedDishName: dish?.name }),
});

const recipeService = {
  /**
   * Khoi's code: trang Công thức — mọi công thức đã duyệt (khách cũng gọi được)
   * → { items: [{ id, title, description, dishId, dishName, thumbnailUrl, servings, prepTimeMinutes, cookTimeMinutes,
   *      caloriesKcal, createdAt, moderatedAt, authorName, authorAvatarUrl, categoryIds: string[], ingredientNames: string[],
   *      likeCount, likesThisWeek, likedByMe }],
   *     categories: [{ id, name }] }
   */
  listRecipes() {
    return apiFetch('/recipes');
  },

  /** Khoi's code: thích / bỏ thích công thức đã duyệt → { liked, likeCount } */
  likeRecipe(id) {
    return apiFetch(`/recipes/${encodeURIComponent(id)}/like`, { method: 'POST' });
  },
  unlikeRecipe(id) {
    return apiFetch(`/recipes/${encodeURIComponent(id)}/like`, { method: 'DELETE' });
  },

  /** Món đang hiện cho ô chọn món. Đổi sang dạng DishPicker cần: { dish_id, name, status } */
  async getActiveDishes() {
    const { items } = await apiFetch('/recipes/dishes');
    return { items: items.map((d) => ({ dish_id: d.id, name: d.name, status: 'active' })) };
  },

  /** Tên nguyên liệu trong kho để gợi ý khi gõ → { items: string[] } */
  getIngredientNames: () => apiFetch('/recipes/ingredients'),
  // Duy's Code : Tìm ingredient theo từ khóa để người dùng chọn dị ứng có sẵn.
  searchIngredientNames: (query, { signal } = {}) => apiFetch(`/recipes/ingredients?q=${encodeURIComponent(query)}`, { signal }),

  /** Khoi's code: từ chỉ đồ động vật (banned_keyword category 'animal') → { items: string[] } */
  getAnimalWords: () => apiFetch('/recipes/animal-words'),

  /** Soi tên nguyên liệu → { items: IngredientCheck[] } (cùng thứ tự, đã bỏ trùng/rỗng) */
  checkIngredients: (names, { signal } = {}) => apiFetch('/recipes/ingredients/check', {
    method: 'POST', body: JSON.stringify({ names }), signal,
  }),

  /** Công thức của chính mình, mới nhất trước → { items: MyRecipe[] } */
  getMyRecipes: () => apiFetch('/recipes/mine'),

  /**
   * Gửi công thức → 201 { message, recipe: MyRecipe, ingredients: IngredientCheck[] }. Server luôn đặt 'pending'.
   * @param {{ dish: {type:'existing', dish:{dish_id}}|{type:'proposed', name}, title, thumbnailUrl, servings,
   *           prepTimeMinutes, cookTimeMinutes, ingredients:{name,amount,unit}[], instructions }} data
   */
  createRecipe: (data) => apiFetch('/recipes', { method: 'POST', body: JSON.stringify(toRecipeBody(data)) }),

  /**
   * Khoi's code: xem công thức ĐÃ DUYỆT (ai cũng xem được, kể cả khách) → RecipeDetail:
   * { id, title, description, dishId, dishName, thumbnailUrl, youtubeUrl, servings, prepTimeMinutes, cookTimeMinutes,
   *   caloriesKcal, instructions, createdAt, authorName, authorAvatarUrl, ingredients: [{ name, amount, unit }] }
   * Chưa duyệt / không tồn tại → lỗi 404.
   */
  getRecipe: (id) => apiFetch(`/recipes/${encodeURIComponent(id)}`),

  /** Khoi's code: 1 công thức của mình, đủ nội dung để sửa → MyRecipeDetail */
  getMyRecipe: (id) => apiFetch(`/recipes/mine/${encodeURIComponent(id)}`),

  /**
   * Khoi's code: "Sửa và gửi lại" công thức bị từ chối (cùng dữ liệu như createRecipe)
   * → 200 { message, recipe: MyRecipe, ingredients }. Server đặt lại 'pending', xoá lý do từ chối cũ.
   */
  resubmitRecipe: (id, data) => apiFetch(`/recipes/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(toRecipeBody(data)),
  }),
  getPendingAdminRecipes: () => apiFetch('/recipes/admin/pending'),
  // Duy's Code : Lấy công thức chờ, đã duyệt và bị từ chối cho trang Admin.
  getAdminRecipes: () => apiFetch('/recipes/admin/all'),
  decideAdminRecipe: (id, action, note = '') => apiFetch(`/recipes/admin/${id}/decision`, {
    method: 'POST', body: JSON.stringify({ action, note }),
  }),
  searchAdminDishes: (query) => apiFetch(`/recipes/admin/dishes/search?q=${encodeURIComponent(query)}`),
  renameRecipeDish: (id, name) => apiFetch(`/recipes/admin/${id}/dish-name`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  linkRecipeDish: (id, dishId, options = {}) => apiFetch(`/recipes/admin/${id}/dish`, {
    method: 'PUT', body: JSON.stringify({ dishId, ...options }),
  }),
};

export default recipeService;
