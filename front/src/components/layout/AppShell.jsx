import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import Toast from '../ui/Toast';
import { useNotifyStore } from '../../store/notifyStore';
import { useAuthStore } from '../../store/authStore';
import { ROLE_ADMIN } from '../../constants/roles';
import { PLATFORM_ROUTES } from '../../platform/platformConfig';

// Каркас авторизованной зоны: боковое меню (десктоп) + хедер + контент + нижняя навигация (мобайл).
export default function AppShell() {
  const { pathname } = useLocation();
  const startPolling = useNotifyStore((s) => s.startPolling);
  const stopPolling = useNotifyStore((s) => s.stopPolling);
  const role = useAuthStore((s) => s.user?.role);

  // Опрос непрочитанных уведомлений, пока пользователь в авторизованной зоне.
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  if (role === ROLE_ADMIN) {
    if (pathname === '/review' || pathname === '/review/history') {
      return <Navigate to={PLATFORM_ROUTES.adminWriteoffs} replace />;
    }
    if (pathname.startsWith('/review/')) {
      return <Navigate to={`${PLATFORM_ROUTES.adminWriteoffs}/${pathname.split('/').pop()}`} replace />;
    }
    if (pathname === '/profile') return <Navigate to={PLATFORM_ROUTES.profile} replace />;
    if (pathname === '/notifications') return <Navigate to={PLATFORM_ROUTES.notifications} replace />;
  }

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 min-h-0 overflow-auto relative">
          <div key={pathname} className="animate-screenIn h-full">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
      <Toast />
    </div>
  );
}
