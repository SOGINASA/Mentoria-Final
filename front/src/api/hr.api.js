import { api } from './client';

export function getWorkspace(storeId) {
  const query = storeId && storeId !== 'all' ? `?store_id=${storeId}` : '';
  return api.get(`/hr/workspace${query}`);
}
