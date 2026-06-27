import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import Logo from '../ui/Logo';
import { useHeaderMeta } from './navConfig';
import { useAuthStore } from '../../store/authStore';
import { initials } from '../../utils/format';

// Верхняя панель: назад / лого (мобайл) / заголовок / аватар (десктоп).
export default function Header() {
  const navigate = useNavigate();
  const { title, back } = useHeaderMeta();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex-none h-[60px] bg-surface border-b border-line flex items-center gap-3 px-4 md:px-5 z-[5]">
      {back ? (
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex-none grid place-items-center border border-line bg-surface rounded-xl text-text cursor-pointer hover:bg-surface2 transition"
          aria-label="back"
        >
          <Icon name="chevronLeft" size={20} strokeWidth={2.2} />
        </button>
      ) : (
        <div className="md:hidden">
          <Logo size="sm" />
        </div>
      )}
      <h2 className="font-head font-semibold text-[19px] text-text m-0 tracking-wide flex-1 truncate">{title}</h2>
      <button
        onClick={() => navigate('/profile')}
        className="hidden md:grid w-10 h-10 rounded-full bg-green text-white border-none place-items-center font-head font-semibold text-[15px] cursor-pointer"
        aria-label="profile"
      >
        {initials(user?.full_name)}
      </button>
    </header>
  );
}
