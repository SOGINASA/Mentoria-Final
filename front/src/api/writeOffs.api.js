import { api } from './client';

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

// Список заявок с фильтрами: { status, store_id, date_from, date_to, scope, page, per_page }
export function listWriteOffs(params) {
  return api.get(`/write-offs${qs(params)}`);
}

export function getWriteOff(id) {
  return api.get(`/write-offs/${id}`);
}

// Создание заявки (роль sender)
export function createWriteOff(payload) {
  return api.post('/write-offs', payload);
}

// Подтверждение авто-черновика (падение) → заявка уходит проверяющему (pending).
// payload (опц.): { comment, type, deduction_employee_id }
export function confirmDraft(id, payload = {}) {
  return api.post(`/write-offs/${id}/confirm`, payload);
}

export function approveWriteOff(id) {
  return api.post(`/write-offs/${id}/approve`);
}

export function rejectWriteOff(id, rejection_reason) {
  return api.post(`/write-offs/${id}/reject`, { rejection_reason });
}

export function retryIiko(id) {
  return api.post(`/write-offs/${id}/retry-iiko`);
}

// Счётчики статусов. scope=mine — только свои.
export function getStats(scope) {
  return api.get(`/write-offs/stats${scope ? `?scope=${scope}` : ''}`);
}
