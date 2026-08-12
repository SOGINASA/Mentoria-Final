import { api } from './client';

export function getWorkspace({ days = 14, storeId } = {}) {
  const params = new URLSearchParams({ days: String(days) });
  if (storeId && storeId !== 'all') params.set('store_id', storeId);
  return api.get(`/operations/workspace?${params.toString()}`);
}
