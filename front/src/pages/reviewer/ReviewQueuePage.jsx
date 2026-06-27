import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tabs from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import PhotoTile from '../../components/ui/PhotoTile';
import TypeBadge from '../../components/ui/TypeBadge';
import Icon from '../../components/ui/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useWriteOffStore } from '../../store/writeOffStore';
import { initials, dateLabel } from '../../utils/format';
import { STATUS_PENDING } from '../../constants/statuses';

export default function ReviewQueuePage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { list, listLoading, stats, fetchList, fetchStats } = useWriteOffStore();
  const [tab, setTab] = useState(STATUS_PENDING);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchList({ status: tab === 'all' ? undefined : STATUS_PENDING, per_page: 50 });
  }, [tab, fetchList]);

  const tabs = [
    { key: STATUS_PENDING, label: t.st_pending_s },
    { key: 'all', label: t.tab_all },
  ];

  return (
    <div className="p-5 max-w-[1080px] mx-auto">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="text-[13.5px] text-muted">{t.queue_count}</div>
        <span
          className="text-white font-head font-semibold text-sm min-w-[26px] h-[26px] rounded-[13px] grid place-items-center px-2"
          style={{ background: 'var(--orange)' }}
        >
          {stats.pending}
        </span>
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {listLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon="check" tone="success" title={t.queue_empty} subtitle={t.queue_empty_sub} />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {list.map((wo) => (
            <button
              key={wo.id}
              onClick={() => navigate(`/review/${wo.id}`)}
              className="flex gap-3.5 bg-surface border border-line rounded-2xl p-3.5 cursor-pointer text-left shadow-card-sm hover:-translate-y-0.5 hover:shadow-card transition"
            >
              <PhotoTile url={wo.photos?.[0]?.url} className="w-[66px] h-[66px] flex-none" iconSize={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-[22px] h-[22px] rounded-full bg-surface2 text-text grid place-items-center font-head font-semibold text-[10px]">
                    {initials(wo.author?.full_name)}
                  </div>
                  <span className="text-[13px] font-semibold text-text truncate">{wo.author?.full_name}</span>
                </div>
                <div className="text-[12.5px] text-muted truncate">{wo.store?.name}</div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <TypeBadge type={wo.type} />
                  <span className="text-[11.5px] text-faint">{dateLabel(wo.created_at, lang)}</span>
                </div>
              </div>
              <Icon name="chevronRight" size={18} strokeWidth={2.2} className="self-center text-faint" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
