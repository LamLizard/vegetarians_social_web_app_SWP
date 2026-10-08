import { apiFetch } from './api';

const shopService = {
  getShops: ({ q, category, page = 1 } = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    if (q && q.trim()) params.set('q', q.trim());
    if (category && Number(category) > 0) params.set('category', String(category));
    return apiFetch(`/shops?${params}`);
  },
  getCategories: () => apiFetch('/shops/categories'),
  getShop: (id) => apiFetch(`/shops/${id}`),
};

export default shopService;
