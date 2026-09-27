import { apiRequest } from './api';

export async function login(credentials) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    token: null,
    body: JSON.stringify(credentials),
  });
  sessionStorage.setItem('accessToken', result.token);
  return result.user;
}

export function logout() {
  sessionStorage.removeItem('accessToken');
}