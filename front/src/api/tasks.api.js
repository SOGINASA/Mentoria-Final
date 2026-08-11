import { api } from './client';

export const list = () => api.get('/tasks');
export const updateStep = (taskId, stepId, payload) => api.patch(`/tasks/${taskId}/steps/${stepId}`, payload);
export const complete = (taskId) => api.post(`/tasks/${taskId}/complete`);
export const reopen = (taskId) => api.post(`/tasks/${taskId}/reopen`);
