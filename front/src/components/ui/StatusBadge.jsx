import { STATUS_STYLE, STATUS_PENDING, STATUS_APPROVED } from '../../constants/statuses';
import { useI18n } from '../../i18n/useI18n';

// Пилюля статуса заявки с цветной точкой. Единый стиль во всём приложении.
export default function StatusBadge({ status, size = 'sm' }) {
  const { t } = useI18n();
  const style = STATUS_STYLE[status] || STATUS_STYLE[STATUS_PENDING];
  const label = status === STATUS_PENDING ? t.st_pending : status === STATUS_APPROVED ? t.st_approved : t.st_rejected;
  const pad = size === 'md' ? '6px 13px' : '4px 9px';
  const fontSize = size === 'md' ? 13 : 11.5;
  return (
    <span
      className="inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap"
      style={{ background: style.bg, color: style.fg, padding: pad, fontSize }}
    >
      <span className="rounded-full" style={{ width: 6, height: 6, background: style.fg }} />
      {label}
    </span>
  );
}
