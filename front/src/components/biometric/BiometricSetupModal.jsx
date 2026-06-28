import { useState } from 'react';
import BottomSheet from '../ui/BottomSheet';
import Fingerprint from './Fingerprint';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { enableBiometric } from '../../lib/biometric';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Привязка биометрии: подтверждение пароля → анимация снятия отпечатка.
export default function BiometricSetupModal({ user, onClose, onEnabled }) {
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);
  const [phase, setPhase] = useState('form'); // form | enrolling | done
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      // Проверяем пароль реальным логином (и заодно обновляем токен)
      await login(user.username, password);
      enableBiometric({ identifier: user.username, name: user.full_name, password });
      setPhase('enrolling');
      await wait(1600);
      setPhase('done');
      await wait(900);
      onEnabled();
    } catch (e) {
      setError(e.status === 401 || e.status === 403 ? t.bio_wrong_pass : e.message || t.error_generic);
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={phase === 'form' ? onClose : undefined}>
      {phase === 'form' && (
        <div>
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-2xl grid place-items-center mb-3" style={{ background: 'var(--green-tint)', color: 'var(--green)' }}>
              <Icon name="fingerprint" size={28} />
            </div>
            <h3 className="font-head font-semibold text-[20px] text-text m-0">{t.bio_enroll_title}</h3>
            <p className="text-muted text-[13px] mt-1 m-0">{t.bio_enroll_sub}</p>
          </div>

          <div className="flex items-center gap-2.5 bg-surface border-[1.5px] border-line rounded-xl px-3.5 h-[52px] focus-within:border-green transition-colors">
            <Icon name="lock" size={18} className="text-faint" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.login_pass}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
              className="flex-1 border-none outline-none bg-transparent text-[15px] text-text"
            />
          </div>

          {error && (
            <div className="text-[13px] font-medium rounded-xl px-3.5 py-2.5 mt-3" style={{ background: 'var(--red-tint)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 h-[50px] rounded-xl border-[1.5px] border-line bg-surface text-text font-semibold text-[14.5px] cursor-pointer">
              {t.cancel}
            </button>
            <button
              onClick={confirm}
              disabled={busy || !password}
              className="flex-[1.4] h-[50px] rounded-xl border-none bg-green text-white font-head font-semibold text-base cursor-pointer grid place-items-center disabled:opacity-60"
            >
              {busy ? <Spinner size={20} /> : t.bio_enroll_btn}
            </button>
          </div>
        </div>
      )}

      {phase !== 'form' && (
        <div className="flex flex-col items-center text-center py-2">
          <Fingerprint size={140} state={phase === 'done' ? 'success' : 'scanning'} />
          <h3 className="font-head font-semibold text-[19px] mt-6 mb-1" style={{ color: phase === 'done' ? 'var(--green)' : 'var(--text)' }}>
            {phase === 'done' ? t.bio_enrolled : t.bio_enrolling}
          </h3>
          {phase === 'enrolling' && <p className="text-muted text-[13px] m-0">{t.bio_scan_sub}</p>}
        </div>
      )}
    </BottomSheet>
  );
}
