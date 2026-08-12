import fs from 'fs';
import { LEGACY_HOME_ROUTE_BY_ROLE, ROLE_MANAGER } from '../constants/roles';
import {
  createPlatformNavigation,
  createPlatformMobileNavigation,
  getPlatformBackRoute,
  getPlatformCompactRouteTitle,
  isPlatformNavigationItemActive,
  PLATFORM_ROUTES,
} from '../platform/platformConfig';

describe('staff platform route contract', () => {
  test('manager has no circular link back to the same platform', () => {
    expect(LEGACY_HOME_ROUTE_BY_ROLE[ROLE_MANAGER]).toBeUndefined();
  });

  test('route constants are unique and stay under /app', () => {
    const routes = Object.values(PLATFORM_ROUTES);
    expect(new Set(routes).size).toBe(routes.length);
    routes.forEach((route) => expect(route).toMatch(/^\/app(?:\/|$)/));
  });

  test('primary navigation uses declared route constants', () => {
    const copy = {
      today: 'Сегодня',
      shifts: 'Смены',
      income: 'Доход',
      tasks: 'Задачи',
      profile: 'Профиль',
      services: 'Сервисы',
    };
    const navigation = createPlatformNavigation(copy, 4);

    expect(navigation.map((item) => item.to)).toEqual([
      PLATFORM_ROUTES.home,
      PLATFORM_ROUTES.shifts,
      PLATFORM_ROUTES.income,
      PLATFORM_ROUTES.tasks,
      PLATFORM_ROUTES.services,
    ]);
    expect(navigation.find((item) => item.to === PLATFORM_ROUTES.tasks).badge).toBe(4);
  });

  test('management roles receive approvals without overloading mobile navigation', () => {
    const copy = {
      today: 'Сегодня', approvals: 'Согласования', shifts: 'Смены', income: 'Доход',
      tasks: 'Задачи', services: 'Сервисы',
    };
    const permissions = ['manager.queue', 'shifts.manage'];

    expect(createPlatformNavigation(copy, 0, permissions).some((item) => item.to === PLATFORM_ROUTES.approvals)).toBe(true);
    expect(createPlatformMobileNavigation(copy, 0, permissions)).toHaveLength(5);
    expect(createPlatformMobileNavigation(copy, 0, permissions).some((item) => item.to === PLATFORM_ROUTES.management)).toBe(true);
    expect(createPlatformMobileNavigation(copy, 0, permissions).some((item) => item.to === PLATFORM_ROUTES.income)).toBe(true);
  });

  test('reviewer receives a dedicated control workspace and compact mobile navigation', () => {
    const copy = {
      today: 'Сегодня', control: 'Контроль', approvals: 'Согласования', shifts: 'Смены',
      income: 'Доход', tasks: 'Задачи', services: 'Сервисы',
    };
    const permissions = ['manager.queue', 'reviewer.control', 'tasks.manage', 'time.manage'];
    const mobile = createPlatformMobileNavigation(copy, 2, permissions);

    expect(mobile).toHaveLength(5);
    expect(mobile.some((item) => item.to === PLATFORM_ROUTES.control)).toBe(true);
    expect(mobile.some((item) => item.to === PLATFORM_ROUTES.management)).toBe(false);
  });

  test('HR receives a dedicated workforce workspace', () => {
    const copy = {
      today: 'Сегодня', hr_workspace: 'HR', approvals: 'Согласования', shifts: 'Смены',
      income: 'Доход', tasks: 'Задачи', services: 'Сервисы',
    };
    const permissions = ['hr.workspace', 'employee_services.manage'];
    const mobile = createPlatformMobileNavigation(copy, 0, permissions);

    expect(mobile.map((item) => item.to)).toEqual([
      PLATFORM_ROUTES.home, PLATFORM_ROUTES.hr, PLATFORM_ROUTES.approvals, PLATFORM_ROUTES.services,
    ]);
    expect(mobile.some((item) => item.to === PLATFORM_ROUTES.management)).toBe(false);
  });

  test('income remains discoverable while payroll integration is unavailable', () => {
    const copy = {
      today: 'Сегодня', shifts: 'Смены', income: 'Доход', tasks: 'Задачи', services: 'Сервисы',
    };

    expect(createPlatformNavigation(copy).some((item) => item.to === PLATFORM_ROUTES.income)).toBe(true);
  });

  test('AppRouter declares every platform destination', () => {
    const source = fs.readFileSync(require.resolve('./AppRouter'), 'utf8');
    const routeSegments = ['', 'shifts', 'income', 'tasks', 'approvals', 'management', 'control', 'hr', 'profile', 'notifications', 'support', 'news', 'services', 'learning', 'documents', 'leave', 'writeoff'];

    expect(source).toContain('path="/app"');
    routeSegments.filter(Boolean).forEach((segment) => {
      expect(source).toContain(`path="${segment}"`);
    });
    expect(source).toContain('exitPath={PLATFORM_ROUTES.home}');
  });

  test('deep service routes have a predictable parent route', () => {
    expect(getPlatformBackRoute('/app/learning/service-standards')).toBe(PLATFORM_ROUTES.learning);
    expect(getPlatformBackRoute(PLATFORM_ROUTES.documents)).toBe(PLATFORM_ROUTES.services);
    expect(getPlatformBackRoute(PLATFORM_ROUTES.profile)).toBe(PLATFORM_ROUTES.home);
  });

  test('services stay active for every nested employee service', () => {
    const servicesItem = createPlatformNavigation({
      today: 'Сегодня', shifts: 'Смены', income: 'Доход', tasks: 'Задачи', services: 'Сервисы',
    }).find((item) => item.to === PLATFORM_ROUTES.services);

    expect(isPlatformNavigationItemActive(servicesItem, PLATFORM_ROUTES.documents)).toBe(true);
    expect(isPlatformNavigationItemActive(servicesItem, '/app/learning/service-standards')).toBe(true);
    expect(isPlatformNavigationItemActive(servicesItem, PLATFORM_ROUTES.profile)).toBe(false);
  });

  test('long service titles have compact mobile equivalents', () => {
    const copy = {
      platform: 'Платформа', services_short: 'Сервисы', learning: 'Обучение',
      documents_short: 'Документы', vacation_short: 'Отпуск', support_short: 'Помощь',
    };
    expect(getPlatformCompactRouteTitle(PLATFORM_ROUTES.services, copy)).toBe('Сервисы');
    expect(getPlatformCompactRouteTitle('/app/learning/service-standards', copy)).toBe('Обучение');
  });
});
