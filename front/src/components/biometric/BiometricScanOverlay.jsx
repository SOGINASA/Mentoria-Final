import { useCallback, useEffect, useRef, useState } from 'react';
import Fingerprint from './Fingerprint';
import { useI18n } from '../../i18n/useI18n';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Полноэкранный сканер для входа по биометрии.
// onAuthenticate: async () => user (бросает при неуспехе)
export default function BiometricScanOverlay({ onAuthenticate, onSuccess, onCancel, enrolled = true }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState('scanning'); // scanning | success | error
  const aliveRef = useRef(true);

  const run = useCallback(async () => {
    setPhase('scanning');
    const start = Date.now();
    try {
      const user = await onAuthenticate();
      const left = 1400 - (Date.now() - start);
      if (left > 0) await wait(left);
      if (!aliveRef.current) return;
      setPhase('success');
      await wait(750);
      if (aliveRef.current) onSuccess(user);
    } catch {
      const left = 1100 - (Date.now() - start);
      if (left > 0) await wait(left);
      if (aliveRef.current) setPhase('error');
    }
  }, [onAuthenticate, onSuccess]);

  useEffect(() => {
    aliveRef.current = true;
    run();
    return () => {
      aliveRef.current = false;
    };
  }, [run]);

  const titles = {
    scanning: { title: t.bio_scan_title, sub: t.bio_scan_sub, color: 'var(--text)' },
    success: { title: t.bio_success, sub: '', color: 'var(--green)' },
    error: {
      title: enrolled ? t.bio_error : t.bio_not_set,
      sub: enrolled ? t.bio_error_sub : t.bio_not_set_sub,
      color: 'var(--red)',
    },
  }[phase];

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-8 animate-fadeIn"
      style={{ background: 'color-mix(in srgb, var(--bg) 86%, transparent)', backdropFilter: 'blur(8px)' }}
    >
      <Fingerprint size={150} state={phase} />

      <h2 className="font-head font-semibold text-[22px] mt-7 mb-1.5 text-center" style={{ color: titles.color }}>
        {titles.title}
      </h2>
      {titles.sub && <p className="text-muted text-sm text-center max-w-[280px]">{titles.sub}</p>}

      {phase === 'error' ? (
        <div className="flex flex-col gap-2.5 w-full max-w-[300px] mt-7">
          {enrolled && (
            <button
              onClick={run}
              className="h-12 rounded-2xl bg-green text-white font-head font-semibold text-base cursor-pointer hover:brightness-110 active:scale-[.98] transition"
            >
              {t.bio_retry}
            </button>
          )}
          <button onClick={onCancel} className="h-12 rounded-2xl border-[1.5px] border-line bg-surface text-text font-semibold text-sm cursor-pointer">
            {t.bio_use_pass}
          </button>
        </div>
      ) : phase === 'scanning' ? (
        <button onClick={onCancel} className="mt-8 text-[13px] font-semibold text-muted cursor-pointer">
          {t.cancel}
        </button>
      ) : null}
    </div>
  );
}
