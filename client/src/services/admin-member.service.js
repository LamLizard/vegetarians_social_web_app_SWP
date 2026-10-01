import { apiFetch } from './api';

// Duy's code: tải toàn bộ thành viên cho bảng trạng thái tài khoản.
export async function getMembers() {
  return apiFetch('/admin/members');
}

// Duy's code: tải hàng đợi account report theo report_case đang pending.
export async function getAccountReports(keyword = '') {
  const query = new URLSearchParams({ search: keyword.trim() });
  return apiFetch(`/admin/members/reported?${query}`);
}

// Duy's code: gửi quyết định cho một report_case tài khoản.
export async function decideAccountReport(caseId, action) {
  return apiFetch(`/admin/members/reported/${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export async function setMemberStatus(accountId, status) {
  return apiFetch(`/admin/members/${accountId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
