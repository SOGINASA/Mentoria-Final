import { api } from './client';

function query(params = {}) {
  const values = Object.entries(params).filter(([, value]) => value && value !== 'all');
  return values.length ? `?${new URLSearchParams(values).toString()}` : '';
}

export const getWorkspace = ({ month, storeId } = {}) => (
  api.get(`/finance/workspace${query({ month, store_id: storeId })}`)
);

export const exportConfirmedHours = ({ month, storeId } = {}) => (
  api.get(`/finance/export${query({ month, store_id: storeId })}`)
);
