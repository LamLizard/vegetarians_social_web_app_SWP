import { apiFetch } from './api';

export async function getMembers({ showOnlyReported = false, keyword = '' } = {}) {
  const query = new URLSearchParams({
    reported: String(showOnlyReported),
    search: keyword.trim(),
  });
  return apiFetch(`/admin/members?${query}`);
}

export async function setMemberStatus(accountId, status) {
  return apiFetch(`/admin/members/${accountId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
