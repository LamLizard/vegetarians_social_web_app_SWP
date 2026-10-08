// Tùng — Sprint 2: tách identity request khỏi save lịch/menu trực tiếp.
import { apiFetch } from './api';
const ROOT = '/shops/my-shop';
const send = (path, method, body) => apiFetch(path, { method, body: JSON.stringify(body) });

const shopManagementService = {
  getMine: signal => apiFetch(ROOT, { signal }),
  requestIdentity: identity => send(`${ROOT}/submissions`, 'POST', identity),
  updateSchedule: (schedule, expectedVersion) => send(ROOT, 'PATCH', { schedule, expectedVersion }),
  listMenu: signal => apiFetch(`${ROOT}/menu`, { signal }),
  addMenu: item => send(`${ROOT}/menu`, 'POST', item),
  updateMenu: (id, update) => send(`${ROOT}/menu/${encodeURIComponent(id)}`, 'PATCH', update),
  listDishes: (page = 1, pendingPage = 1, signal) => apiFetch(`${ROOT}/dishes?${new URLSearchParams({ page: String(page), pendingPage: String(pendingPage), pageSize: '20' })}`, { signal }),
};
export default shopManagementService;
