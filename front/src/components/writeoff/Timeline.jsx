import { useI18n } from '../../i18n/useI18n';
import { dateLabel } from '../../utils/format';
import { STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED } from '../../constants/statuses';
import { IIKO_SYNCED } from '../../constants/iiko';

// История заявки (created → review → решение → iiko).
export default function Timeline({ wo }) {
  const { t, lang } = useI18n();

  const items = [
    { title: t.tl_created, sub: dateLabel(wo.created_at, lang), tone: 'green' },
  ];

  // Черновик ещё не передан на проверку — отдельная ветка.
  if (wo.status === STATUS_DRAFT) {
    items.push({ title: t.tl_draft, sub: '', tone: 'amber' });
    return <TimelineList t={t} items={items} />;
  }

  items.push({ title: t.tl_review, sub: wo.store?.name || '', tone: 'green' });

  if (wo.status === STATUS_PENDING) {
    items.push({ title: t.tl_pending, sub: '', tone: 'amber' });
  }
  if (wo.status === STATUS_APPROVED) {
    items.push({ title: t.tl_approved, sub: wo.reviewer?.full_name || '', tone: 'green' });
    if (wo.iiko_sync_status === IIKO_SYNCED) {
      items.push({ title: t.tl_iiko, sub: wo.iiko_act_id || 'iiko', tone: 'gst' });
    }
  }
  if (wo.status === STATUS_REJECTED) {
    items.push({ title: t.tl_rejected, sub: wo.reviewer?.full_name || '', tone: 'red' });
  }

  return <TimelineList t={t} items={items} />;
}

const DOT = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', gst: 'var(--gst)' };
const RING = { green: 'var(--green-tint)', amber: 'var(--amber-tint)', red: 'var(--red-tint)', gst: 'var(--gst-tint)' };

function TimelineList({ t, items }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="text-xs text-faint font-semibold tracking-wide uppercase mb-3.5">{t.timeline}</div>
      {items.map((it, i) => (
        <div key={i} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <span className="w-3.5 h-3.5 rounded-full flex-none" style={{ background: DOT[it.tone], border: `3px solid ${RING[it.tone]}` }} />
            {i < items.length - 1 && <span className="w-0.5 flex-1" style={{ background: 'var(--line)' }} />}
          </div>
          <div className="pb-4 flex-1">
            <div className="text-[13.5px] font-semibold text-text">{it.title}</div>
            {it.sub && <div className="text-xs text-muted mt-0.5">{it.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
