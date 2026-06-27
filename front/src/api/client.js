// HTTP-клиент к Flask-бэкенду. JWT в заголовке + автоматический refresh при 401.

export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5252').replace(/\/$/, '');
const API_PREFIX = `${API_URL}/api`;

const ACCESS_KEY = 'bahandi_access';
const REFRESH_KEY = 'bahandi_refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function parse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function tryRefresh() {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  const res = await fetch(`${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh}` },
  });
  if (!res.ok) return false;
  const data = await parse(res);
  if (data?.access_token) {
    tokenStore.set({ access: data.access_token });
    return true;
  }
  return false;
}

/**
 * Базовый запрос.
 * @param {string} path           — путь после /api (например '/write-offs')
 * @param {object} opts
 * @param {string} [opts.method]
 * @param {object} [opts.body]    — JSON-тело
 * @param {FormData} [opts.form]  — multipart-тело (для загрузки фото)
 * @param {boolean} [opts.auth]   — слать токен (по умолчанию true)
 */
export async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  let payload;

  if (form) {
    payload = form; // браузер сам выставит multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const doFetch = () => {
    const h = { ...headers };
    if (auth && tokenStore.access) h.Authorization = `Bearer ${tokenStore.access}`;
    return fetch(`${API_PREFIX}${path}`, { method, headers: h, body: payload });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const data = await parse(res);

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Ошибка ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, form) => request(path, { method: 'POST', form }),
};
