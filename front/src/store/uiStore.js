import { create } from 'zustand';

// Тема и язык сохраняются между сессиями.
const THEME_KEY = 'bahandi_theme';
const LANG_KEY = 'bahandi_lang';
const NOTIF_KEY = 'bahandi_notif';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

let toastTimer = null;

export const useUiStore = create((set, get) => ({
  theme: localStorage.getItem(THEME_KEY) || 'light',
  lang: localStorage.getItem(LANG_KEY) || 'ru',
  notif: localStorage.getItem(NOTIF_KEY) !== 'off',
  toast: null,
  // modal: { type: 'approve' | 'reject', writeOffId } | null
  modal: null,

  initTheme() {
    applyTheme(get().theme);
  },
  setTheme(theme) {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
  setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
  toggleNotif() {
    const next = !get().notif;
    localStorage.setItem(NOTIF_KEY, next ? 'on' : 'off');
    set({ notif: next });
  },

  showToast(message) {
    set({ toast: message });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
  hideToast() {
    set({ toast: null });
  },

  openModal(modal) {
    set({ modal });
  },
  closeModal() {
    set({ modal: null });
  },
}));
