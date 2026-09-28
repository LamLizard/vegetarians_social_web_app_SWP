import { apiRequest } from './api';

export async function getProfile() {
  return apiRequest('/api/users/me');
}

export async function updateProfile(payload) {
  return apiRequest('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
