import { api, request } from './client';

export const list = () => api.get('/cases');
export const create = (payload) => api.post('/cases', payload);
export const addMessage = (caseId, body, key) => request(`/cases/${caseId}/messages`, {
  method: 'POST', body: { body }, headers: key ? { 'Idempotency-Key': key } : {},
});
export const update = (caseId, payload, key) => request(`/cases/${caseId}`, {
  method: 'PATCH', body: payload, headers: key ? { 'Idempotency-Key': key } : {},
});
