import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import { useNavItems, useIsActive } from './navConfig';

// Нижняя навигация (мобайл) — основной способ навигации.
export default function BottomNav() {
  const navigate = useNavigate();
  const items = useNavItems();
  const isActive = useIsActive();

  return (
    <nav className="md:hidden flex-none bg-surface border-t border-line flex px-1.5 pt-1.5 pb-2">
      {items.map((it) => {
        const active = isActive(it);
        return (
          <button
            key={it.to}
            onClick={() => navigate(it.to)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 px-0.5 bg-transparent border-none cursor-pointer relative transition"
            style={{ color: active ? 'var(--green)' : 'var(--faint)' }}
          >
            {it.badge > 0 && (
              <span
                className="absolute top-0.5 text-white text-[9.5px] font-bold min-w-4 h-4 rounded-lg grid place-items-center px-1"
                style={{ background: 'var(--orange)', right: '50%', marginRight: '-22px' }}
              >
                {it.badge}
              </span>
            )}
            <Icon name={it.icon} size={23} />
            <span className="text-[10.5px] font-semibold tracking-tight">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
