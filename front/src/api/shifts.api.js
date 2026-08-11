import { api } from './client';

export const list = (query = '') => api.get(`/shifts${query ? `?${query}` : ''}`);
export const listOpen = () => api.get('/shifts?open=1');
export const listRequests = () => api.get('/shifts/requests');
export const createRequest = (shiftId, payload) => api.post(`/shifts/${shiftId}/requests`, payload);
