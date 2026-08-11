export const PLATFORM_ROUTES = Object.freeze({
  home: '/app',
  shifts: '/app/shifts',
  income: '/app/income',
  tasks: '/app/tasks',
  profile: '/app/profile',
  notifications: '/app/notifications',
  support: '/app/support',
  news: '/app/news',
  services: '/app/services',
  learning: '/app/learning',
  documents: '/app/documents',
  leave: '/app/leave',
  writeoff: '/app/writeoff',
});

const SECONDARY_PLATFORM_ROUTES = [
  PLATFORM_ROUTES.profile,
  PLATFORM_ROUTES.notifications,
  PLATFORM_ROUTES.support,
  PLATFORM_ROUTES.news,
  PLATFORM_ROUTES.learning,
  PLATFORM_ROUTES.documents,
  PLATFORM_ROUTES.leave,
  PLATFORM_ROUTES.writeoff,
];

const EMPLOYEE_SERVICE_ROUTES = [
  PLATFORM_ROUTES.services,
  PLATFORM_ROUTES.learning,
  PLATFORM_ROUTES.documents,
  PLATFORM_ROUTES.leave,
  PLATFORM_ROUTES.support,
];

export function isSecondaryPlatformRoute(pathname) {
  return SECONDARY_PLATFORM_ROUTES.some((route) => (
    pathname === route || pathname.startsWith(`${route}/`)
  ));
}

export function isEmployeeServiceRoute(pathname) {
  return EMPLOYEE_SERVICE_ROUTES.some((route) => (
    pathname === route || pathname.startsWith(`${route}/`)
  ));
}

export function getPlatformBackRoute(pathname) {
  if (pathname.startsWith(`${PLATFORM_ROUTES.learning}/`)) return PLATFORM_ROUTES.learning;
  if ([PLATFORM_ROUTES.learning, PLATFORM_ROUTES.documents, PLATFORM_ROUTES.leave, PLATFORM_ROUTES.support].includes(pathname)) {
    return PLATFORM_ROUTES.services;
  }
  return PLATFORM_ROUTES.home;
}

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
    {
      to: PLATFORM_ROUTES.services,
      icon: 'grid',
      label: copy.services,
      activeRoutes: EMPLOYEE_SERVICE_ROUTES,
    },
  ];
}

export function createEmployeeServiceNavigation(copy) {
  return [
    { to: PLATFORM_ROUTES.services, end: true, icon: 'grid', label: copy.service_overview },
    { to: PLATFORM_ROUTES.learning, icon: 'book', label: copy.learning_center },
    { to: PLATFORM_ROUTES.documents, icon: 'fileText', label: copy.documents },
    { to: PLATFORM_ROUTES.leave, icon: 'calendar', label: copy.vacation },
    { to: PLATFORM_ROUTES.support, icon: 'helpCircle', label: copy.support },
  ];
}

export function isPlatformNavigationItemActive(item, pathname, routerIsActive = false) {
  if (routerIsActive) return true;
  return item.activeRoutes?.some((route) => (
    pathname === route || pathname.startsWith(`${route}/`)
  )) || false;
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
    [PLATFORM_ROUTES.services]: copy.services,
    [PLATFORM_ROUTES.learning]: copy.learning_center,
    [PLATFORM_ROUTES.documents]: copy.documents,
    [PLATFORM_ROUTES.leave]: copy.vacation,
    [PLATFORM_ROUTES.writeoff]: copy.writeoff,
  };
  const exactTitle = titles[pathname];
  if (exactTitle) return exactTitle;

  const parentRoute = Object.keys(titles).find((route) => pathname.startsWith(`${route}/`));
  return titles[parentRoute] || copy.platform;
}

export { SECONDARY_PLATFORM_ROUTES };
