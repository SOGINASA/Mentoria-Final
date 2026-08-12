import { api } from './client';

export const list = () => api.get('/cases');
export const create = (payload) => api.post('/cases', payload);
export const addMessage = (caseId, body) => api.post(`/cases/${caseId}/messages`, { body });
export const update = (caseId, payload) => api.patch(`/cases/${caseId}`, payload);
