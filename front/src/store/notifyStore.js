import { create } from 'zustand';
import * as notifyApi from '../api/notifications.api';
import { useUiStore } from './uiStore';

// Один таймер опроса на всё приложение (вне состояния — не вызывает ререндеров).
let pollTimer = null;
const POLL_MS = 15000;

export const useNotifyStore = create((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  pagination: null,

  // Лёгкий запрос для бейджа (используется в polling).
  async fetchUnread() {
    try {
      const { unread } = await notifyApi.unreadCount();
      set({ unread });
    } catch {
      // тихо — счётчик не критичен
    }
  },

  // Полный список (для экрана уведомлений).
  async fetchList(params = {}) {
    set({ loading: true });
    try {
      const data = await notifyApi.listNotifications(params);
      set({
        items: data.notifications || [],
        unread: data.unread ?? get().unread,
        pagination: data.pagination || null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  async markRead(id) {
    const target = get().items.find((n) => n.id === id);
    const wasUnread = target && !target.is_read;
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unread: wasUnread ? Math.max(0, s.unread - 1) : s.unread,
    }));
    try {
      await notifyApi.markRead(id);
    } catch {
      // откат не делаем — на следующем poll/refresh синхронизируется
    }
  },

  async markAllRead() {
    set((s) => ({ items: s.items.map((n) => ({ ...n, is_read: true })), unread: 0 }));
    try {
      await notifyApi.markAllRead();
    } catch {
      /* no-op */
    }
  },

  // Запускается в AppShell (авторизованная зона). Опрашивает бейдж раз в POLL_MS,
  // только если уведомления включены в настройках.
  startPolling() {
    get().fetchUnread();
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (useUiStore.getState().notif) get().fetchUnread();
    }, POLL_MS);
  },

  stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },
}));
