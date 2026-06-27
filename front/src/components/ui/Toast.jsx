import { useUiStore } from '../../store/uiStore';
import Icon from './Icon';

// Глобальный тост (всплывает снизу по центру). Читает uiStore.toast.
export default function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] flex items-center gap-2.5 text-white
        text-[13.5px] font-medium px-5 py-3 rounded-2xl animate-fadeUp whitespace-nowrap max-w-[92vw]"
      style={{ background: 'var(--ink)', boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}
    >
      <span className="w-5 h-5 rounded-full grid place-items-center flex-none" style={{ background: 'var(--gst)' }}>
        <Icon name="check" size={12} strokeWidth={3} />
      </span>
      {toast}
    </div>
  );
}
