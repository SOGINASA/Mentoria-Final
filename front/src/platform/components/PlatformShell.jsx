import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import Icon from '../../components/ui/Icon';
import Toast from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useNotifyStore } from '../../store/notifyStore';
import { initials } from '../../utils/format';
import { HOME_ROUTE_BY_ROLE } from '../../constants/roles';
import { usePlatformStore } from '../../store/platformStore';
import { usePlatformCopy } from '../platformCopy';
import {
  createEmployeeServiceNavigation,
  createPlatformMobileNavigation,
  createPlatformNavigation,
  getPlatformBackRoute,
  getPlatformCompactRouteTitle,
  getPlatformRouteTitle,
  isEmployeeServiceRoute,
  isPlatformNavigationItemActive,
  isSecondaryPlatformRoute,
  PLATFORM_ROUTES,
} from '../platformConfig';

function usePlatformNav() {
  const { p } = usePlatformCopy();
  const pendingTaskCount = usePlatformStore((state) => (
    state.tasks.filter((task) => !task.done).length
  ));
  const permissions = usePlatformStore((state) => state.permissions);
  return createPlatformNavigation(p, pendingTaskCount, permissions);
}

function usePlatformMobileNav() {
  const { p } = usePlatformCopy();
  const pendingTaskCount = usePlatformStore((state) => state.tasks.filter((task) => !task.done).length);
  const permissions = usePlatformStore((state) => state.permissions);
  return createPlatformMobileNavigation(p, pendingTaskCount, permissions);
}

function PlatformSidebar() {
  const nav = usePlatformNav();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const { p } = usePlatformCopy();

  return (
    <aside className="hidden h-[100dvh] w-[272px] flex-none flex-col self-start overflow-y-auto overscroll-contain border-r border-line bg-surface px-4 py-5 lg:sticky lg:top-0 lg:flex">
      <button
        type="button"
        onClick={() => navigate(PLATFORM_ROUTES.home)}
        className="self-start rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label={p.today}
      >
        <Logo size="md" />
      </button>
      <div className="mt-3 mb-6 px-1.5">
        <div className="font-head text-[15px] font-semibold tracking-wide text-text">{p.platform}</div>
        <div className="mt-1 inline-flex rounded-full bg-orange-tint px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-orange">
          {p.beta}
        </div>
      </div>

      <nav aria-label="Platform navigation" className="flex flex-col gap-1.5">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
            {({ isActive: routerIsActive }) => {
              const isActive = isPlatformNavigationItemActive(item, pathname, routerIsActive);
              return (
                <span aria-current={isActive ? 'page' : undefined} className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-semibold transition-[color,background-color,box-shadow,transform] duration-200 active:scale-[.985] ${isActive ? 'bg-brand text-on-brand shadow-card-sm' : 'text-muted hover:bg-surface2 hover:text-text'}`}>
                  <Icon name={item.icon} size={21} strokeWidth={isActive ? 2.25 : 2} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span className={`grid min-w-5 h-5 place-items-center rounded-full px-1.5 text-[10px] font-bold ${isActive ? 'bg-white text-green' : 'bg-orange text-white'}`}>
                      {item.badge}
                    </span>
                  )}
                </span>
              );
            }}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />
      <button
        type="button"
        onClick={() => navigate(HOME_ROUTE_BY_ROLE[user?.role] || '/')}
        className="mb-3 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface2 px-3.5 text-left text-[13px] font-semibold text-muted transition-colors hover:border-green hover:text-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <Icon name="arrowSwap" size={19} />
        <span>{p.old_system}</span>
      </button>
      <NavLink
        to={PLATFORM_ROUTES.profile}
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand font-head text-[15px] font-semibold text-on-brand">
          {initials(user?.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-text">{user?.full_name}</span>
          <span className="block truncate text-[11.5px] text-muted">{user?.store?.name || p.platform}</span>
        </span>
        <Icon name="chevronRight" size={17} className="text-faint" />
      </NavLink>
    </aside>
  );
}

function PlatformHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unread = useNotifyStore((s) => s.unread);
  const { p } = usePlatformCopy();
  const secondary = isSecondaryPlatformRoute(pathname);
  const title = getPlatformRouteTitle(pathname, p);
  const compactTitle = getPlatformCompactRouteTitle(pathname, p);
  const backRoute = getPlatformBackRoute(pathname);
  const backTitle = getPlatformRouteTitle(backRoute, p);

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(secondary ? backRoute : PLATFORM_ROUTES.home)}
        className={`h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-[12px] font-bold text-muted transition-colors hover:bg-surface2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${secondary ? 'inline-flex gap-1.5 px-2 sm:px-3' : 'grid lg:hidden'}`}
        aria-label={secondary ? `${p.back}: ${backTitle}` : p.today}
      >
        {secondary ? <><Icon name="chevronLeft" size={21} /><span className="hidden sm:inline">{p.back}</span></> : <Logo size="sm" />}
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="m-0 truncate font-head text-[18px] font-semibold tracking-wide text-text sm:text-[20px]"><span className="sm:hidden">{compactTitle}</span><span className="hidden sm:inline">{title}</span></h1>
        <span className="hidden text-[11px] font-medium text-muted sm:block">{p.platform}</span>
      </div>
      <button
        type="button"
        onClick={() => navigate(PLATFORM_ROUTES.notifications)}
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-line bg-surface text-text transition-colors hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        aria-label={p.notifications}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-orange px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => navigate(PLATFORM_ROUTES.profile)}
        className="grid h-11 w-11 place-items-center rounded-full bg-brand font-head text-[15px] font-semibold text-on-brand transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label={p.profile}
      >
        {initials(user?.full_name)}
      </button>
    </header>
  );
}

function PlatformSectionNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  if (!isEmployeeServiceRoute(pathname)) return null;

  const items = createEmployeeServiceNavigation(p);
  const currentItem = items.find((item) => (
    pathname === item.to || (!item.end && pathname.startsWith(`${item.to}/`))
  )) || items[0];
  return (
    <nav aria-label={p.services} className="bg-bg">
      <div className="px-4 pt-3 sm:px-6 lg:hidden">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-green"><Icon name={currentItem.icon} size={19} /></span>
          <select
            aria-label={p.services}
            value={currentItem.to}
            onChange={(event) => navigate(event.target.value)}
            className="min-h-12 w-full appearance-none rounded-2xl border border-line bg-surface py-3 pl-12 pr-11 text-[14px] font-semibold text-text shadow-card-sm outline-none transition-colors focus:border-green focus:ring-2 focus:ring-green/20"
          >
            {items.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-faint"><Icon name="chevronRight" size={18} className="rotate-90" /></span>
        </div>
      </div>
      <div className="mx-auto hidden w-full max-w-[1180px] px-8 pt-4 lg:block">
        <div className="grid grid-cols-5 gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card-sm">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${isActive ? 'bg-surface2 text-text' : 'text-muted hover:bg-surface2 hover:text-text'}`}
            >
              <Icon name={item.icon} size={17} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

function PlatformBottomNav() {
  const nav = usePlatformMobileNav();
  const { pathname } = useLocation();
  return (
    <nav aria-label="Platform navigation" className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-flow-col auto-cols-fr border-t border-line bg-surface/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
      {nav.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="h-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
          {({ isActive: routerIsActive }) => {
            const isActive = isPlatformNavigationItemActive(item, pathname, routerIsActive);
            return (
              <span aria-current={isActive ? 'page' : undefined} className={`relative flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${isActive ? 'text-green' : 'text-faint'}`}>
                <span className={`grid h-7 min-w-10 place-items-center rounded-full transition-colors ${isActive ? 'bg-green-tint' : ''}`}>
                  <Icon name={item.icon} size={21} strokeWidth={isActive ? 2.35 : 2} />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute top-0 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[8px] font-bold text-white" style={{ right: 'calc(50% - 25px)' }}>
                    {item.badge}
                  </span>
                )}
              </span>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}

export default function PlatformShell() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const startPolling = useNotifyStore((s) => s.startPolling);
  const stopPolling = useNotifyStore((s) => s.stopPolling);
  const hydrate = usePlatformStore((s) => s.hydrate);

  useEffect(() => {
    startPolling();
    hydrate().catch(() => {});
    return () => stopPolling();
  }, [hydrate, startPolling, stopPolling]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex min-h-[100dvh] bg-bg text-text">
      <a href="#platform-main" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-on-brand transition-transform focus:translate-y-0">К содержимому</a>
      <PlatformSidebar />
      <div className="min-w-0 flex-1">
        <PlatformHeader />
        <PlatformSectionNav />
        <main ref={mainRef} tabIndex={-1} className="outline-none pb-[92px] lg:pb-8" id="platform-main">
          <div key={pathname} className="platform-route-frame">
            <Outlet />
          </div>
        </main>
      </div>
      <PlatformBottomNav />
      <Toast />
    </div>
  );
}
