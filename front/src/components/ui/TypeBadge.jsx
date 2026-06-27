import { TYPE_WITH_DEDUCTION } from '../../constants/writeOffTypes';
import { useI18n } from '../../i18n/useI18n';

// Маленький чип типа списания (с удержанием / без).
export default function TypeBadge({ type }) {
  const { t } = useI18n();
  const hold = type === TYPE_WITH_DEDUCTION;
  return (
    <span
      className="inline-flex items-center font-semibold rounded-md"
      style={{
        fontSize: 11,
        padding: '3px 8px',
        background: hold ? 'var(--orange-tint)' : 'var(--gst-tint)',
        color: hold ? 'var(--orange)' : 'var(--gst)',
      }}
    >
      {hold ? t.type_hold : t.type_nohold}
    </span>
  );
}
