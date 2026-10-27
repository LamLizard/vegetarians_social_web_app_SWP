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

  deleteItem(planId, mealSlot, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/items/${encodeURIComponent(mealSlot)}`, {
      method: 'DELETE',
      signal,
    });
  },

  randomize(planId, { signal } = {}) {
    return apiFetch(`${ROOT}/${encodeURIComponent(planId)}/randomize`, {
      method: 'POST',
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
