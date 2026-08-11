import { api } from './client';

export const list = () => api.get('/news');
export const markRead = (postId) => api.post(`/news/${postId}/read`);
