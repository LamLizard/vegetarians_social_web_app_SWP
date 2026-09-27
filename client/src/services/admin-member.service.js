import { apiRequest } from './api';

export async function getMembers({ showOnlyReported = false, keyword = '' } = {}) {
  const query = new URLSearchParams({
    reported: String(showOnlyReported),
    search: keyword.trim(),
  });
  return apiRequest(`/api/admin/members?${query}`);
}

export async function setMemberStatus(accountId, status) {
  return apiRequest(`/api/admin/members/${accountId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
