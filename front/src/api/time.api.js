import { api, request } from './client';

export const current = () => api.get('/time/current');
export const listTimecards = () => api.get('/time/timecards');
export const createEvent = (payload, idempotencyKey) => request('/time/events', {
  method: 'POST',
  body: payload,
  headers: { 'Idempotency-Key': idempotencyKey },
});
export const createCorrection = (timecardId, payload) => api.post(`/time/timecards/${timecardId}/corrections`, payload);
