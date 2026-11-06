import { apiFetch } from './api';

export function reportAccount({ accountId, reasonCode, reasonText }) {
  return apiFetch(`/accounts/${encodeURIComponent(accountId)}/report`, {
    method: 'POST',
    body: JSON.stringify({ reasonCode, reasonText }),
  });
}
