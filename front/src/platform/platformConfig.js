export const PLATFORM_ROUTES = Object.freeze({
  home: '/app',
  shifts: '/app/shifts',
  income: '/app/income',
  tasks: '/app/tasks',
  profile: '/app/profile',
  notifications: '/app/notifications',
  support: '/app/support',
  news: '/app/news',
});

export const SECONDARY_PLATFORM_ROUTES = new Set([
  PLATFORM_ROUTES.notifications,
  PLATFORM_ROUTES.support,
  PLATFORM_ROUTES.news,
]);

export function createPlatformNavigation(copy, pendingTaskCount = 0, flags = {}) {
  return [
    { to: PLATFORM_ROUTES.home, end: true, icon: 'home', label: copy.today },
    { to: PLATFORM_ROUTES.shifts, icon: 'calendar', label: copy.shifts },
    ...(flags.income === false ? [] : [{ to: PLATFORM_ROUTES.income, icon: 'wallet', label: copy.income }]),
    {
      to: PLATFORM_ROUTES.tasks,
      icon: 'clipboard',
      label: copy.tasks,
      badge: pendingTaskCount,
    },
    { to: PLATFORM_ROUTES.profile, icon: 'user', label: copy.profile },
  ];
}

export function getPlatformRouteTitle(pathname, copy) {
  const titles = {
    [PLATFORM_ROUTES.home]: copy.today,
    [PLATFORM_ROUTES.shifts]: copy.shifts,
    [PLATFORM_ROUTES.income]: copy.income,
    [PLATFORM_ROUTES.tasks]: copy.tasks,
    [PLATFORM_ROUTES.profile]: copy.profile,
    [PLATFORM_ROUTES.notifications]: copy.notifications,
    [PLATFORM_ROUTES.support]: copy.support,
    [PLATFORM_ROUTES.news]: copy.news,
  };
  return titles[pathname] || copy.platform;
}
