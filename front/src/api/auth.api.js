import { request, api } from './client';

// Вход по логину/email + пароль. Токены приходят в ответе.
export function login(identifier, password) {
  return request('/auth/login', { method: 'POST', body: { identifier, password }, auth: false });
}

export function me() {
  return api.get('/auth/me');
}

export function changePassword(current_password, new_password) {
  return api.post('/auth/change-password', { current_password, new_password });
}
