import { Navigate } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import { HOME_ROUTE_BY_ROLE } from '../constants/roles';

function FullScreenLoader() {
  return (
    <div className="h-full grid place-items-center bg-bg">
      <Spinner size={32} />
    </div>
  );
}

// Доступ только авторизованным. Пока сессия восстанавливается — лоадер.
export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'idle' || status === 'loading') return <FullScreenLoader />;
  if (status !== 'authed') return <Navigate to="/login" replace />;
  return children;
}

// Доступ только для определённых ролей. Иначе — на домашний экран роли.
export function RequireRole({ roles, children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (!roles.includes(role)) return <Navigate to={HOME_ROUTE_BY_ROLE[role] || '/'} replace />;
  return children;
}

// Страница входа: авторизованного отправляем на его домашний экран.
export function GuestOnly({ children }) {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  if (status === 'idle' || status === 'loading') return <FullScreenLoader />;
  if (status === 'authed') return <Navigate to={HOME_ROUTE_BY_ROLE[role] || '/'} replace />;
  return children;
}
