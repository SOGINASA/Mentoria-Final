import { api } from './client';

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

// Лента уведомлений: { unread?: 1, page, per_page }
export function listNotifications(params) {
  return api.get(`/notifications${qs(params)}`);
}

// Счётчик непрочитанных (для бейджа-колокольчика) — лёгкий запрос для polling.
export function unreadCount() {
  return api.get('/notifications/unread-count');
}

export function markRead(id) {
  return api.post(`/notifications/${id}/read`);
}

export function markAllRead() {
  return api.post('/notifications/read-all');
}
