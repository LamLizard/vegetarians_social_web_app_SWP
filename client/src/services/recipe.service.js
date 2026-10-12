// =====================================================================
//  Khoi's code: Service trang Tạo công thức (Recipe) — PHƯƠNG ÁN B: GỌI API THẬT (12/10/2026)
//  Server: server/src/routes/recipe.routes.js  (gắn ở /api/recipes)
//
//  MyRecipe (tab "Công thức đã gửi"):
//    { id, title, dishId, dishName, proposedDishName, thumbnailUrl, servings, prepTimeMinutes,
//      cookTimeMinutes, status: 'pending'|'approved'|'rejected', moderationNote, createdAt,
//      ingredientCount, proposedIngredientCount }
//  IngredientCheck: { name, known, isAnimalDerived, keyword }
//    known = false  → chưa có trong kho nguyên liệu, gửi kèm công thức cho Admin duyệt
//    isAnimalDerived / keyword → nghi không chay: tô đỏ, KHÔNG chặn gửi (Admin xem lại)
// =====================================================================
import { apiFetch } from './api';

const recipeService = {
  /** Món đang hiện cho ô chọn món. Đổi sang dạng DishPicker cần: { dish_id, name, status } */
  async getActiveDishes() {
    const { items } = await apiFetch('/recipes/dishes');
    return { items: items.map((d) => ({ dish_id: d.id, name: d.name, status: 'active' })) };
  },

  /** Tên nguyên liệu trong kho để gợi ý khi gõ → { items: string[] } */
  getIngredientNames: () => apiFetch('/recipes/ingredients'),
  // Duy's Code : Tìm ingredient theo từ khóa để người dùng chọn dị ứng có sẵn.
  searchIngredientNames: (query, { signal } = {}) => apiFetch(`/recipes/ingredients?q=${encodeURIComponent(query)}`, { signal }),

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
  createRecipe: ({ dish, ...rest }) => apiFetch('/recipes', {
    method: 'POST',
    body: JSON.stringify({
      ...rest,
      ...(dish?.type === 'existing' ? { dishId: dish.dish.dish_id } : { proposedDishName: dish?.name }),
    }),
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
