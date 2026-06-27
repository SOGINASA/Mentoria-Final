import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { HOME_ROUTE_BY_ROLE } from '../../constants/roles';

// Демо-учётки бэкенда (back/seed_data.py)
const DEMO = {
  sender: { identifier: 'sender1', password: 'sender123' },
  reviewer: { identifier: 'reviewer', password: 'reviewer123' },
  admin: { identifier: 'admin', password: 'admin123' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useUiStore();
  const login = useAuthStore((s) => s.login);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(creds) {
    const id = creds?.identifier ?? identifier;
    const pass = creds?.password ?? password;
    if (!id || !pass) return;
    setLoading(true);
    setError(null);
    try {
      const user = await login(id, pass);
      navigate(HOME_ROUTE_BY_ROLE[user.role] || '/', { replace: true });
    } catch (e) {
      setError(e.status === 401 || e.status === 403 ? t.login_error : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-bg">
      {/* компактные переключатели темы/языка */}
      <div className="flex justify-end gap-2 p-3.5">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 grid place-items-center bg-surface border border-line rounded-xl text-muted cursor-pointer"
          aria-label="theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <div className="flex bg-surface border border-line rounded-xl p-0.5">
          {['ru', 'kz'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-3 py-1.5 rounded-lg font-semibold text-[12.5px] cursor-pointer transition"
              style={{ background: lang === l ? 'var(--green)' : 'transparent', color: lang === l ? '#fff' : 'var(--muted)' }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 pb-10 pt-6">
        <div className="w-full max-w-[380px] flex flex-col items-center">
          <div className="animate-pop">
            <Logo size="lg" />
          </div>
          <h1 className="font-head font-semibold text-[25px] text-text text-center mt-7 mb-1">{t.login_title}</h1>
          <p className="text-muted text-sm text-center mb-7">{t.login_sub}</p>

          <form
            className="w-full flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text">{t.login_login}</span>
              <div className="flex items-center gap-2.5 bg-surface border-[1.5px] border-line rounded-xl px-3.5 h-[52px] focus-within:border-green transition-colors">
                <Icon name="user" size={18} className="text-faint" />
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t.login_ph_login}
                  autoComplete="username"
                  className="flex-1 border-none outline-none bg-transparent text-[15px] text-text"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text">{t.login_pass}</span>
              <div className="flex items-center gap-2.5 bg-surface border-[1.5px] border-line rounded-xl px-3.5 h-[52px] focus-within:border-green transition-colors">
                <Icon name="lock" size={18} className="text-faint" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="flex-1 border-none outline-none bg-transparent text-[15px] text-text"
                />
              </div>
            </label>

            {error && (
              <div
                className="text-[13px] font-medium rounded-xl px-3.5 py-2.5"
                style={{ background: 'var(--red-tint)', color: 'var(--red)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-[54px] rounded-2xl bg-green text-white font-head font-semibold text-lg tracking-wide cursor-pointer
                hover:brightness-110 active:scale-[.98] transition disabled:opacity-70 grid place-items-center"
              style={{ boxShadow: '0 8px 20px -6px var(--green)' }}
            >
              {loading ? <Spinner size={22} className="!border-white/40 !border-t-white" /> : t.login_btn}
            </button>

            <div className="flex items-center gap-2 mt-1">
              <span className="flex-1 h-px bg-line" />
              <span className="text-[11.5px] text-faint">{t.login_demo}</span>
              <span className="flex-1 h-px bg-line" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => submit(DEMO.sender)}
                className="h-11 border-[1.5px] border-line bg-surface rounded-xl text-text font-semibold text-[12.5px] cursor-pointer hover:border-green transition-colors"
              >
                {t.role_sender}
              </button>
              <button
                type="button"
                onClick={() => submit(DEMO.reviewer)}
                className="h-11 border-[1.5px] border-line bg-surface rounded-xl text-text font-semibold text-[12.5px] cursor-pointer hover:border-green transition-colors"
              >
                {t.role_reviewer}
              </button>
              <button
                type="button"
                onClick={() => submit(DEMO.admin)}
                className="h-11 border-[1.5px] border-line bg-surface rounded-xl text-text font-semibold text-[12.5px] cursor-pointer hover:border-green transition-colors"
              >
                {t.role_admin}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
