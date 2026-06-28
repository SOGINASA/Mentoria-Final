import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { initials } from '../../utils/format';
import { ROLE_REVIEWER, ROLE_ADMIN } from '../../constants/roles';
import { isBiometricEnabled, disableBiometric, isBiometricSupported } from '../../lib/biometric';
import BiometricSetupModal from '../../components/biometric/BiometricSetupModal';

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-[46px] h-[26px] rounded-[13px] border-none cursor-pointer relative transition-colors"
      style={{ background: on ? 'var(--green)' : 'var(--line)' }}
    >
      <span
        className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}
      />
    </button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme, notif, toggleNotif } = useUiStore();
  const showToast = useUiStore((s) => s.showToast);
  const { user, logout } = useAuthStore();

  const [bioOn, setBioOn] = useState(isBiometricEnabled());
  const [bioSupported, setBioSupported] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setBioSupported);
  }, []);

  const roleLabel = user?.role === ROLE_REVIEWER ? t.role_reviewer : user?.role === ROLE_ADMIN ? t.role_admin : t.role_sender;

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function toggleBiometric() {
    if (bioBusy) return;
    if (bioOn) {
      setBioBusy(true);
      try {
        await disableBiometric();
        setBioOn(false);
        showToast(t.bio_disabled_toast);
      } finally {
        setBioBusy(false);
      }
    } else if (!bioSupported) {
      showToast(t.bio_unsupported);
    } else {
      setSetupOpen(true);
    }
  }

  return (
    <div className="p-6 max-w-[560px] mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        <div
          className="w-[84px] h-[84px] rounded-full text-white grid place-items-center font-head font-semibold text-[32px]"
          style={{ background: 'linear-gradient(135deg,var(--green),var(--green-d))', boxShadow: '0 10px 24px -8px var(--green)' }}
        >
          {initials(user?.full_name)}
        </div>
        <h2 className="font-head font-semibold text-[23px] text-text mt-4 mb-1">{user?.full_name}</h2>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full" style={{ background: 'var(--green-tint)', color: 'var(--green)' }}>
          {roleLabel}
        </span>
      </div>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-4">
        {user?.store?.name && (
          <div className="flex items-center gap-3 p-4 border-b border-line2">
            <Icon name="pin" size={20} style={{ color: 'var(--green)' }} />
            <div className="flex-1">
              <div className="text-[11.5px] text-muted">{t.f_point}</div>
              <div className="text-sm font-semibold text-text mt-px">{user.store.name}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 p-4">
          <Icon name="user" size={20} style={{ color: 'var(--green)' }} />
          <div className="flex-1">
            <div className="text-[11.5px] text-muted">{t.f_id}</div>
            <div className="text-sm font-semibold text-text mt-px">BHD-{user?.id}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-faint font-semibold tracking-wide uppercase mb-2.5 ml-1">{t.settings}</div>
      <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line2">
          <Icon name="globe" size={20} className="text-muted" />
          <span className="flex-1 text-sm font-medium text-text">{t.language}</span>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            {['ru', 'kz'].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="px-3 py-1.5 rounded-md font-semibold text-xs cursor-pointer transition"
                style={{ background: lang === l ? 'var(--green)' : 'transparent', color: lang === l ? '#fff' : 'var(--muted)' }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line2">
          <Icon name="moon" size={20} className="text-muted" />
          <span className="flex-1 text-sm font-medium text-text">{t.dark_theme}</span>
          <Toggle on={theme === 'dark'} onClick={toggleTheme} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line2">
          <Icon name="bell" size={20} className="text-muted" />
          <span className="flex-1 text-sm font-medium text-text">{t.notifications}</span>
          <Toggle on={notif} onClick={toggleNotif} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Icon name="fingerprint" size={20} style={{ color: bioOn ? 'var(--green)' : 'var(--muted)' }} />
          <div className="flex-1">
            <div className="text-sm font-medium text-text">{t.bio_setting}</div>
            <div className="text-[11.5px] text-muted">{t.bio_setting_sub}</div>
          </div>
          <Toggle on={bioOn} onClick={toggleBiometric} />
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full h-[50px] rounded-2xl border-[1.5px] border-line bg-surface font-semibold text-[14.5px] cursor-pointer flex items-center justify-center gap-2.5 hover:bg-red-tint transition"
        style={{ color: 'var(--red)' }}
      >
        <Icon name="logout" size={19} />
        {t.logout}
      </button>

      {setupOpen && (
        <BiometricSetupModal
          user={user}
          onClose={() => setSetupOpen(false)}
          onEnabled={() => {
            setSetupOpen(false);
            setBioOn(true);
            showToast(t.bio_enrolled);
          }}
        />
      )}
    </div>
  );
}
