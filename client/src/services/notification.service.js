import { apiFetch } from './api';

export const getMyNotifications = () => apiFetch('/notifications');
export const markNotificationRead = (id) => apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiFetch('/notifications/read-all', { method: 'POST' });
