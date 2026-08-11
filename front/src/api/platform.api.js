import { api } from './client';

export const bootstrap = () => api.get('/platform/bootstrap');
export const updateProfile = (payload) => api.patch('/platform/profile', payload);
