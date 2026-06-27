import { useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import Icon from '../ui/Icon';
import { useNavItems, useIsActive } from './navConfig';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { ROLE_REVIEWER, ROLE_ADMIN } from '../../constants/roles';
import { initials } from '../../utils/format';

// Боковое меню (десктоп).
export default function Sidebar() {
  const navigate = useNavigate();
  const items = useNavItems();
  const isActive = useIsActive();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);

  const roleLabel =
    user?.role === ROLE_REVIEWER ? t.role_reviewer : user?.role === ROLE_ADMIN ? t.role_admin : t.role_sender;

  return (
    <aside className="hidden md:flex w-[248px] flex-none bg-surface border-r border-line flex-col p-4 pt-5">
      <Logo size="md" className="self-start ml-1.5 mb-2" />
      <span className="text-[11px] text-faint font-semibold tracking-[1.2px] uppercase mt-1.5 mb-4 ml-2">
        {t.app_name}
      </span>

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = isActive(it);
          return (
            <button
              key={it.to}
              onClick={() => navigate(it.to)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer font-semibold text-[14.5px] text-left transition"
              style={{
                background: active ? 'var(--green-tint)' : 'transparent',
                color: active ? 'var(--green)' : 'var(--muted)',
              }}
            >
              <Icon name={it.icon} size={20} />
              <span className="flex-1">{it.label}</span>
              {it.badge > 0 && (
                <span
                  className="text-white text-[11px] font-bold min-w-5 h-5 rounded-[10px] grid place-items-center px-1.5"
                  style={{ background: 'var(--orange)' }}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface2">
        <div className="w-9 h-9 rounded-full bg-green text-white grid place-items-center font-head font-semibold text-base">
          {initials(user?.full_name)}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-text truncate">{user?.full_name}</div>
          <div className="text-[11.5px] text-muted">{roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}
