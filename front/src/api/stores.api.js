import { api } from './client';

// Активные торговые точки
export function getStores() {
  return api.get('/stores');
}

// Сотрудники точки (кандидаты на удержание)
export function getStoreEmployees(storeId) {
  return api.get(`/stores/${storeId}/employees`);
}

// Все сотрудники (опционально с фильтром по точке)
export function getEmployees(storeId) {
  return api.get(`/stores/employees${storeId ? `?store_id=${storeId}` : ''}`);
}
