import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import Toast from '../ui/Toast';
import { useNotifyStore } from '../../store/notifyStore';

// Каркас авторизованной зоны: боковое меню (десктоп) + хедер + контент + нижняя навигация (мобайл).
export default function AppShell() {
  const { pathname } = useLocation();
  const startPolling = useNotifyStore((s) => s.startPolling);
  const stopPolling = useNotifyStore((s) => s.stopPolling);

  // Опрос непрочитанных уведомлений, пока пользователь в авторизованной зоне.
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

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
