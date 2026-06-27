import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import Toast from '../ui/Toast';

// Каркас авторизованной зоны: боковое меню (десктоп) + хедер + контент + нижняя навигация (мобайл).
export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 min-h-0 overflow-auto relative">
          <div key={pathname} className="animate-screenIn min-h-full">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
      <Toast />
    </div>
  );
}
