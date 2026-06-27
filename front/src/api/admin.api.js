import { api } from './client';

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

// --- Пользователи ---
export function listUsers(role) {
  return api.get(`/admin/users${qs({ role })}`);
}
export function createUser(payload) {
  return api.post('/admin/users', payload);
}
export function updateUser(id, payload) {
  return api.put(`/admin/users/${id}`, payload);
}
export function deactivateUser(id) {
  return api.del(`/admin/users/${id}`);
}

// --- Точки ---
// Все точки, включая деактивированные (для управления в админке).
export function listStores() {
  return api.get('/admin/stores');
}
export function createStore(payload) {
  return api.post('/admin/stores', payload);
}
export function updateStore(id, payload) {
  return api.put(`/admin/stores/${id}`, payload);
}
export function deactivateStore(id) {
  return api.del(`/admin/stores/${id}`);
}

// --- Сотрудники ---
// Все сотрудники, включая деактивированных (для управления в админке).
export function listEmployees(storeId) {
  return api.get(`/admin/employees${storeId ? `?store_id=${storeId}` : ''}`);
}
export function createEmployee(payload) {
  return api.post('/admin/employees', payload);
}
export function updateEmployee(id, payload) {
  return api.put(`/admin/employees/${id}`, payload);
}
export function deactivateEmployee(id) {
  return api.del(`/admin/employees/${id}`);
}
