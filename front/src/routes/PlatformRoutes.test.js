import fs from 'fs';
import {
  createPlatformNavigation,
  getPlatformBackRoute,
  PLATFORM_ROUTES,
} from '../platform/platformConfig';

describe('staff platform route contract', () => {
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
    };
    const navigation = createPlatformNavigation(copy, 4);

    expect(navigation.map((item) => item.to)).toEqual([
      PLATFORM_ROUTES.home,
      PLATFORM_ROUTES.shifts,
      PLATFORM_ROUTES.income,
      PLATFORM_ROUTES.tasks,
      PLATFORM_ROUTES.profile,
    ]);
    expect(navigation.find((item) => item.to === PLATFORM_ROUTES.tasks).badge).toBe(4);
  });

  test('AppRouter declares every platform destination', () => {
    const source = fs.readFileSync(require.resolve('./AppRouter'), 'utf8');
    const routeSegments = ['', 'shifts', 'income', 'tasks', 'profile', 'notifications', 'support', 'news', 'services', 'learning', 'documents', 'leave'];

    expect(source).toContain('path="/app"');
    routeSegments.filter(Boolean).forEach((segment) => {
      expect(source).toContain(`path="${segment}"`);
    });
  });

  test('deep service routes have a predictable parent route', () => {
    expect(getPlatformBackRoute('/app/learning/service-standards')).toBe(PLATFORM_ROUTES.learning);
    expect(getPlatformBackRoute(PLATFORM_ROUTES.documents)).toBe(PLATFORM_ROUTES.services);
    expect(getPlatformBackRoute(PLATFORM_ROUTES.services)).toBe(PLATFORM_ROUTES.profile);
  });
});
