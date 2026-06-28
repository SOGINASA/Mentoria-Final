// Вход по биометрии через WebAuthn / passkeys (Face ID, Touch ID, отпечаток,
// Windows Hello). Сам ключ хранится в защищённом хранилище устройства и на
// сервере — пароль/секрет в браузере НЕ хранится.
//
// В localStorage держим только лёгкую ПОДСКАЗКУ (identifier + имя) — какой
// пользователь включил биометрию на этом устройстве. identifier нужен для
// authenticate-options, имя — для приветствия на экране входа. Это не секрет.

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import * as webauthnApi from '../api/webauthn.api';

const KEY = 'bahandi_biometric';

export function getBiometricHint() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function isBiometricEnabled() {
  const h = getBiometricHint();
  return !!(h && h.identifier);
}

export function getBiometricName() {
  return getBiometricHint()?.name || null;
}

export function getBiometricIdentifier() {
  return getBiometricHint()?.identifier || null;
}

function rememberBiometric({ identifier, name }) {
  localStorage.setItem(KEY, JSON.stringify({ identifier, name }));
}

function forgetBiometricHint() {
  localStorage.removeItem(KEY);
}

// Поддерживает ли устройство/браузер вход по биометрии (платформенный аутентификатор).
export async function isBiometricSupported() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function deviceName() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Браузер';
}

// Регистрация биометрического ключа (пользователь уже залогинен паролем → есть JWT).
// Бросает при отмене/ошибке аутентификатора.
export async function registerBiometricKey(user) {
  const options = await webauthnApi.getRegisterOptions();
  const attestation = await startRegistration({ optionsJSON: options });
  await webauthnApi.verifyRegister({ ...attestation, device_name: deviceName() });
  rememberBiometric({ identifier: user.username, name: user.full_name });
}

// Вход по биометрическому ключу → { user, access_token, refresh_token }.
export async function authenticateBiometricKey(identifier) {
  const options = await webauthnApi.getAuthOptions(identifier);
  const assertion = await startAuthentication({ optionsJSON: options });
  return webauthnApi.verifyAuth(identifier, assertion);
}

// Полное отключение: удалить ключи на сервере (best-effort) + забыть подсказку.
export async function disableBiometric() {
  try {
    const creds = await webauthnApi.listCredentials();
    await Promise.all((creds || []).map((c) => webauthnApi.deleteCredential(c.id).catch(() => {})));
  } catch {
    // оффлайн / нет авторизации — всё равно забываем локально
  }
  forgetBiometricHint();
}

// Понятное сообщение об ошибке WebAuthn (для тостов/модалок).
export function biometricErrorMessage(e, t) {
  const name = e?.name || '';
  if (name === 'NotAllowedError') return t.bio_cancelled;
  if (name === 'InvalidStateError') return t.bio_already;
  if (name === 'SecurityError') return t.bio_security;
  return e?.message || t.error_toast;
}
