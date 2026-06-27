import { useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { useWriteOffStore } from '../../store/writeOffStore';
import { ROLE_REVIEWER, ROLE_ADMIN } from '../../constants/roles';

// Пункты навигации зависят от роли. Очередь проверяющего показывает бейдж pending.
export function useNavItems() {
  const { t } = useI18n();
  const role = useAuthStore((s) => s.user?.role);
  const pendingCount = useWriteOffStore((s) => s.stats.pending);
  const draftCount = useWriteOffStore((s) => s.stats.draft);

  if (role === ROLE_ADMIN) {
    return [
      { to: '/admin', label: t.nav_admin, icon: 'sliders', match: ['/admin'] },
      { to: '/review', label: t.nav_queue, icon: 'queue', badge: pendingCount, match: ['/review'], exclude: ['/review/history'] },
      { to: '/profile', label: t.nav_profile, icon: 'user', match: ['/profile'] },
    ];
  }
  if (role === ROLE_REVIEWER) {
    return [
      { to: '/review', label: t.nav_queue, icon: 'queue', badge: pendingCount, match: ['/review'], exclude: ['/review/history'] },
      { to: '/review/history', label: t.nav_history, icon: 'history', match: ['/review/history'] },
      { to: '/profile', label: t.nav_profile, icon: 'user', match: ['/profile'] },
    ];
  }
  return [
    { to: '/', label: t.nav_home, icon: 'home', match: ['/'], exact: true },
    { to: '/create', label: t.nav_create, icon: 'plus', match: ['/create'] },
    { to: '/my-requests', label: t.nav_my, icon: 'list', badge: draftCount, match: ['/my-requests'] },
    { to: '/profile', label: t.nav_profile, icon: 'user', match: ['/profile'] },
  ];
}

export function useIsActive() {
  const { pathname } = useLocation();
  return (item) => {
    if (item.exact) return pathname === item.to;
    if (item.exclude && item.exclude.some((p) => pathname.startsWith(p))) return false;
    return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };
}

// Заголовок экрана + признак кнопки «назад» по текущему пути.
export function useHeaderMeta() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  const titleMap = [
    { test: (p) => p === '/', title: t.nav_home },
    { test: (p) => p === '/create', title: t.create_cta, back: true },
    { test: (p) => p.startsWith('/my-requests/'), title: t.nav_my, back: true },
    { test: (p) => p === '/my-requests', title: t.nav_my },
    { test: (p) => p === '/review/history', title: t.nav_history },
    { test: (p) => p.startsWith('/review/') , title: t.nav_queue, back: true },
    { test: (p) => p === '/review', title: t.nav_queue },
    { test: (p) => p === '/admin', title: t.nav_admin },
    { test: (p) => p === '/notifications', title: t.notifications, back: true },
    { test: (p) => p === '/profile', title: t.nav_profile },
  ];
  const found = titleMap.find((m) => m.test(pathname));
  return { title: found?.title || '', back: !!found?.back };
}
