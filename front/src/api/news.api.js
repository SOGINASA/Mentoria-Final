import { api, request } from './client';

export const list = () => api.get('/news');
export const markRead = (postId) => api.post(`/news/${postId}/read`);
export const create = (payload, key) => request('/news/manager', {
  method: 'POST', body: payload, headers: key ? { 'Idempotency-Key': key } : {},
});
