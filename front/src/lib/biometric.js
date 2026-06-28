// Локальное «включение» входа по биометрии.
//
// ВАЖНО (demo): это чисто фронтовая имитация. Для реального продакшена тут нужен
// WebAuthn / passkeys (на вебе) или Keychain + LocalAuthentication (на нативе) —
// пароль в браузере хранить нельзя. Здесь, для демо хакатона, креды кладутся в
// localStorage (base64), чтобы вход по биометрии действительно срабатывал.

const KEY = 'bahandi_biometric';

function encode(s) {
  return btoa(unescape(encodeURIComponent(s)));
}
function decode(s) {
  return decodeURIComponent(escape(atob(s)));
}

export function getBiometric() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function isBiometricEnabled() {
  const b = getBiometric();
  return !!(b && b.enabled && b.identifier && b.secret);
}

export function getBiometricName() {
  return getBiometric()?.name || null;
}

export function enableBiometric({ identifier, name, password }) {
  localStorage.setItem(KEY, JSON.stringify({ enabled: true, identifier, name, secret: encode(password) }));
}

export function disableBiometric() {
  localStorage.removeItem(KEY);
}

export function getBiometricCreds() {
  const b = getBiometric();
  if (!b || !b.secret) return null;
  try {
    return { identifier: b.identifier, password: decode(b.secret) };
  } catch {
    return null;
  }
}
