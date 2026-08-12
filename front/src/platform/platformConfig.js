export const PLATFORM_ROUTES = Object.freeze({
  home: '/app',
  shifts: '/app/shifts',
  income: '/app/income',
  tasks: '/app/tasks',
  approvals: '/app/approvals',
  management: '/app/management',
  control: '/app/control',
  hr: '/app/hr',
  finance: '/app/finance',
  operations: '/app/operations',
  admin: '/app/admin',
  adminWriteoffs: '/app/admin/writeoffs',
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
  if (pathname.startsWith(`${PLATFORM_ROUTES.adminWriteoffs}/`)) return true;
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
  if (pathname.startsWith(`${PLATFORM_ROUTES.adminWriteoffs}/`)) return PLATFORM_ROUTES.adminWriteoffs;
  if (pathname.startsWith(`${PLATFORM_ROUTES.learning}/`)) return PLATFORM_ROUTES.learning;
  if ([PLATFORM_ROUTES.learning, PLATFORM_ROUTES.documents, PLATFORM_ROUTES.leave, PLATFORM_ROUTES.support].includes(pathname)) {
    return PLATFORM_ROUTES.services;
  }
  return PLATFORM_ROUTES.home;
}

export function canManageApprovals(permissions = []) {
  return permissions.includes('*') || permissions.some((permission) => [
    'manager.queue', 'employee_services.manage', 'time.manage', 'tasks.manage', 'shifts.manage',
  ].includes(permission));
}

export function canManageWorkspace(permissions = []) {
  return permissions.includes('*') || (permissions.includes('manager.queue') && permissions.includes('shifts.manage'));
}

export function canUseReviewerControl(permissions = []) {
  return permissions.includes('reviewer.control');
}

export function canUseHrWorkspace(permissions = []) {
  return permissions.includes('hr.workspace');
}

export function canUseFinanceWorkspace(permissions = []) {
  return permissions.includes('finance.workspace');
}

export function canUseOperationsWorkspace(permissions = []) {
  return permissions.includes('operations.workspace');
}

export function canUseSystemAdmin(permissions = []) {
  return permissions.includes('*');
}

const ROUTE_FEATURES = {
  [PLATFORM_ROUTES.shifts]: 'shifts',
  [PLATFORM_ROUTES.income]: 'income',
  [PLATFORM_ROUTES.tasks]: 'tasks',
  [PLATFORM_ROUTES.services]: 'hr_services',
};

function featureIsEnabled(featureFlags, key) {
  return featureFlags?.staff_platform !== false && featureFlags?.[key] !== false;
}

export function createPlatformNavigation(copy, pendingTaskCount = 0, permissions = [], featureFlags = {}) {
  if (canUseSystemAdmin(permissions)) {
    return [
      { to: PLATFORM_ROUTES.admin, end: true, icon: 'sliders', label: copy.admin_workspace },
      { to: PLATFORM_ROUTES.adminWriteoffs, icon: 'queue', label: copy.writeoffs_queue },
      { to: PLATFORM_ROUTES.home, end: true, icon: 'grid', label: copy.platform },
    ];
  }
  const navigation = [
    { to: PLATFORM_ROUTES.home, end: true, icon: 'home', label: copy.today },
    ...(canUseReviewerControl(permissions) ? [{ to: PLATFORM_ROUTES.control, icon: 'shieldCheck', label: copy.control }] : []),
    ...(canUseHrWorkspace(permissions) ? [{ to: PLATFORM_ROUTES.hr, icon: 'briefcase', label: copy.hr_workspace }] : []),
    ...(canUseFinanceWorkspace(permissions) ? [{ to: PLATFORM_ROUTES.finance, icon: 'wallet', label: copy.finance_workspace }] : []),
    ...(canUseOperationsWorkspace(permissions) ? [{ to: PLATFORM_ROUTES.operations, icon: 'sliders', label: copy.operations_workspace }] : []),
    ...(canManageWorkspace(permissions) ? [{ to: PLATFORM_ROUTES.management, icon: 'briefcase', label: copy.management }] : []),
    ...(canManageApprovals(permissions) ? [{ to: PLATFORM_ROUTES.approvals, icon: 'queue', label: copy.approvals }] : []),
    { to: PLATFORM_ROUTES.shifts, icon: 'calendar', label: copy.shifts },
    { to: PLATFORM_ROUTES.income, icon: 'wallet', label: copy.income },
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
  ].filter((item) => !ROUTE_FEATURES[item.to]
    || featureIsEnabled(featureFlags, ROUTE_FEATURES[item.to]));
  if (canUseOperationsWorkspace(permissions)) {
    return navigation.filter((item) => [PLATFORM_ROUTES.home, PLATFORM_ROUTES.operations,
      PLATFORM_ROUTES.management, PLATFORM_ROUTES.approvals, PLATFORM_ROUTES.services].includes(item.to));
  }
  if (canUseHrWorkspace(permissions)) {
    return navigation.filter((item) => [PLATFORM_ROUTES.home, PLATFORM_ROUTES.hr,
      PLATFORM_ROUTES.approvals, PLATFORM_ROUTES.services].includes(item.to));
  }
  if (canUseFinanceWorkspace(permissions)) {
    return navigation.filter((item) => [PLATFORM_ROUTES.home, PLATFORM_ROUTES.finance,
      PLATFORM_ROUTES.services].includes(item.to));
  }
  if (canUseReviewerControl(permissions)) {
    return navigation.filter((item) => [PLATFORM_ROUTES.home, PLATFORM_ROUTES.control,
      PLATFORM_ROUTES.approvals, PLATFORM_ROUTES.shifts, PLATFORM_ROUTES.tasks,
      PLATFORM_ROUTES.services].includes(item.to));
  }
  return navigation;
}

export function createPlatformMobileNavigation(copy, pendingTaskCount = 0, permissions = [], featureFlags = {}) {
  const navigation = createPlatformNavigation(copy, pendingTaskCount, permissions, featureFlags);
  if (canUseOperationsWorkspace(permissions)) return navigation;
  if (canUseReviewerControl(permissions)) {
    return navigation.filter((item) => [
      PLATFORM_ROUTES.home, PLATFORM_ROUTES.control, PLATFORM_ROUTES.approvals,
      PLATFORM_ROUTES.tasks, PLATFORM_ROUTES.services,
    ].includes(item.to));
  }
  if (canUseHrWorkspace(permissions)) {
    return navigation.filter((item) => [
      PLATFORM_ROUTES.home, PLATFORM_ROUTES.hr, PLATFORM_ROUTES.approvals,
      PLATFORM_ROUTES.services,
    ].includes(item.to));
  }
  if (canUseFinanceWorkspace(permissions)) return navigation;
  return canManageWorkspace(permissions)
    ? navigation.filter((item) => ![PLATFORM_ROUTES.shifts, PLATFORM_ROUTES.tasks].includes(item.to))
    : navigation;
}

export function createEmployeeServiceNavigation(copy, featureFlags = {}) {
  return [
    { to: PLATFORM_ROUTES.services, end: true, icon: 'grid', label: copy.service_overview },
    { to: PLATFORM_ROUTES.learning, icon: 'book', label: copy.learning_center },
    { to: PLATFORM_ROUTES.documents, icon: 'fileText', label: copy.documents },
    { to: PLATFORM_ROUTES.leave, icon: 'calendar', label: copy.vacation },
    { to: PLATFORM_ROUTES.support, icon: 'helpCircle', label: copy.support },
  ].filter((item) => item.to === PLATFORM_ROUTES.support
    ? featureIsEnabled(featureFlags, 'support_cases')
    : featureIsEnabled(featureFlags, 'hr_services'));
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
    [PLATFORM_ROUTES.approvals]: copy.approvals,
    [PLATFORM_ROUTES.management]: copy.management,
    [PLATFORM_ROUTES.control]: copy.control,
    [PLATFORM_ROUTES.hr]: copy.hr_workspace,
    [PLATFORM_ROUTES.finance]: copy.finance_workspace,
    [PLATFORM_ROUTES.operations]: copy.operations_workspace,
    [PLATFORM_ROUTES.admin]: copy.admin_workspace,
    [PLATFORM_ROUTES.adminWriteoffs]: copy.writeoffs_queue,
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

  const parentRoute = Object.keys(titles).sort((a, b) => b.length - a.length).find((route) => pathname.startsWith(`${route}/`));
  return titles[parentRoute] || copy.platform;
}

export function getPlatformCompactRouteTitle(pathname, copy) {
  const titles = {
    [PLATFORM_ROUTES.services]: copy.services_short,
    [PLATFORM_ROUTES.learning]: copy.learning,
    [PLATFORM_ROUTES.documents]: copy.documents_short,
    [PLATFORM_ROUTES.leave]: copy.vacation_short,
    [PLATFORM_ROUTES.support]: copy.support_short,
  };
  const exactTitle = titles[pathname];
  if (exactTitle) return exactTitle;

  const parentRoute = Object.keys(titles).find((route) => pathname.startsWith(`${route}/`));
  return titles[parentRoute] || getPlatformRouteTitle(pathname, copy);
}

export { SECONDARY_PLATFORM_ROUTES };
