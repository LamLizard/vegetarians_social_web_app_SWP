import { apiFetch } from './api';

const ROOT = '/admin/moderation/post-edits';

const postEditModerationService = {
  listPending: ({ page = 1, limit = 20 } = {}, signal) =>
    apiFetch(`${ROOT}?${new URLSearchParams({ page: String(page), limit: String(limit) })}`, { signal }),
  getPending: (id, signal) => apiFetch(`${ROOT}/${encodeURIComponent(id)}`, { signal }),
  decide: (id, action, note) => apiFetch(`${ROOT}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, ...(note ? { note } : {}) }),
  }),
};

export default postEditModerationService;
