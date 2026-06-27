import PhotoTile from './PhotoTile';
import StatusBadge from './StatusBadge';
import { useI18n } from '../../i18n/useI18n';
import { TYPE_WITH_DEDUCTION } from '../../constants/writeOffTypes';
import { dateLabel } from '../../utils/format';

// Карточка заявки для списков отправителя / истории.
// variant: 'type' (заголовок — тип списания) | 'author' (заголовок — отправитель)
export default function RequestCard({ wo, onClick, variant = 'type' }) {
  const { t, lang } = useI18n();
  const photo = wo.photos?.[0]?.url;
  const point = wo.store?.name || '—';
  const date = dateLabel(wo.created_at, lang);
  const typeLabel = wo.type === TYPE_WITH_DEDUCTION ? t.type_hold : t.type_nohold;
  const title = variant === 'author' ? wo.author?.full_name || '—' : typeLabel;
  const sub = variant === 'author' ? `${point} · ${date}` : point;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 bg-surface border border-line rounded-2xl p-3 cursor-pointer text-left
        shadow-card-sm hover:-translate-y-0.5 hover:shadow-card transition w-full"
    >
      <PhotoTile url={photo} className="w-[60px] h-[60px] flex-none" iconSize={24} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14.5px] text-text truncate">{title}</div>
        <div className="text-[12.5px] text-muted truncate mt-0.5">{sub}</div>
        {variant === 'type' && <div className="text-[11.5px] text-faint mt-0.5">{date}</div>}
      </div>
      <div className="self-start">
        <StatusBadge status={wo.status} />
      </div>
    </button>
  );
}
