import { apiFetch } from './api';

const ROOT = '/meal-plans';

const mealPlanService = {
  getWeek(weekStart, { signal } = {}) {
    const params = new URLSearchParams({ weekStart });
    return apiFetch(`${ROOT}/week?${params.toString()}`, { signal });
  },

  getCurrent(weekStart, options = {}) {
    return this.getWeek(weekStart, options);
  },

  createDay(payload, { signal } = {}) {
    return apiFetch(ROOT, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },

  createWeek(weekStart, options = {}) {
    return this.createDay({ planDate: weekStart, mealsPerDay: 3 }, options);
  },

  /** Thêm 1 món vào bữa, giữ nguyên các món đã có (1 bữa nhiều món). */
  addItem(planId, mealSlot, recipeId, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/items`, {
      method: 'POST',
      body: JSON.stringify({ mealSlot, recipeId }),
      signal,
    });
  },

  /** Đặt lại bữa bằng đúng 1 món (thay thế toàn bộ bữa). */
  updateItem(planId, mealSlot, recipeId, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/items/${encodeURIComponent(mealSlot)}`, {
      method: 'PUT',
      body: JSON.stringify({ recipeId }),
      signal,
    });
  },

  saveItem(planId, dayNo, mealSlot, recipeId, { signal } = {}) {
    return this.updateItem(planId, mealSlot, recipeId, { signal });
  },

  /** Xoá 1 món theo item_id. */
  removeItem(planId, itemId, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      signal,
    });
  },

  /** Xoá cả bữa. */
  deleteItem(planId, mealSlot, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/items/${encodeURIComponent(mealSlot)}`, {
      method: 'DELETE',
      signal,
    });
  },

  /**
   * Random món cho các bữa còn trống.
   * @param {object} [options]
   * @param {number} [options.householdSize] số người ăn
   * @param {number[]} [options.personTargets] kcal mục tiêu của từng người
   * @param {boolean} [options.replace] xoá món hiện có trước khi random
   */
  randomize(planId, { signal, ...options } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/randomize`, {
      method: 'POST',
      body: JSON.stringify(options),
      signal,
    });
  },

  getAvailableRecipes(query = '', nutritionGroup = '', { signal } = {}) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nutritionGroup) params.set('nutritionGroup', nutritionGroup);
    return apiFetch(`/recipes/available?${params.toString()}`, { signal });
  },
};

export default mealPlanService;
