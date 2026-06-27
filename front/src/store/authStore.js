import { create } from 'zustand';
import { tokenStore } from '../api/client';
import * as authApi from '../api/auth.api';

// status: 'idle' | 'loading' | 'authed' | 'guest'
export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  // Восстановление сессии при старте приложения (по сохранённому токену).
  async init() {
    if (!tokenStore.access) {
      set({ status: 'guest' });
      return;
    }
    set({ status: 'loading' });
    try {
      const { user } = await authApi.me();
      set({ user, status: 'authed' });
    } catch {
      tokenStore.clear();
      set({ user: null, status: 'guest' });
    }
  },

  async login(identifier, password) {
    set({ error: null });
    const data = await authApi.login(identifier, password);
    tokenStore.set({ access: data.access_token, refresh: data.refresh_token });
    set({ user: data.user, status: 'authed' });
    return data.user;
  },

  logout() {
    tokenStore.clear();
    set({ user: null, status: 'guest', error: null });
  },

  setError(error) {
    set({ error });
  },

  get role() {
    return get().user?.role || null;
  },
}));
