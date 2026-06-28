import { request, api } from './client';

// Вход по биометрии (WebAuthn / passkey). Бэкенд: /api/auth/webauthn/*
// Эндпоинты опций возвращают готовый WebAuthn-JSON (py_webauthn options_to_json),
// совместимый с @simplewebauthn/browser.

// Опции для регистрации ключа. Нужен JWT — пользователь уже залогинен паролем.
export function getRegisterOptions() {
  return api.post('/auth/webauthn/register-options');
}

// Сохранить публичный ключ после navigator.credentials.create().
// attestation — результат startRegistration() (+ опц. device_name).
export function verifyRegister(attestation) {
  return api.post('/auth/webauthn/register', attestation);
}

// Опции для входа по ключу (без авторизации) — по email/username.
export function getAuthOptions(identifier) {
  return request('/auth/webauthn/authenticate-options', {
    method: 'POST',
    body: { identifier },
    auth: false,
  });
}

// Проверить подпись и получить JWT (формат как у обычного логина: user + токены).
export function verifyAuth(identifier, credential) {
  return request('/auth/webauthn/authenticate', {
    method: 'POST',
    body: { identifier, credential },
    auth: false,
  });
}

// Управление ключами (нужен JWT).
export function listCredentials() {
  return api.get('/auth/webauthn/credentials');
}

export function deleteCredential(id) {
  return api.del(`/auth/webauthn/credentials/${id}`);
}
