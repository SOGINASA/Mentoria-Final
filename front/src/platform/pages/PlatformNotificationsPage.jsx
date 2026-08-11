import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../store/authStore';
import { useNotifyStore } from '../../store/notifyStore';
import { ROLE_SENDER } from '../../constants/roles';
import { dateLabel } from '../../utils/format';
import { usePlatformCopy } from '../platformCopy';
import { EmptyPlatformState, IconTile, PageIntro, PlatformButton, PlatformCard, StatusPill } from '../components/PlatformUi';

export default function PlatformNotificationsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { p, lang } = usePlatformCopy();
  const { items, loading, error, unread, fetchList, markRead, markAllRead } = useNotifyStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchList({ per_page: 50 });
  }, [fetchList]);

  const filtered = filter === 'unread' ? items.filter((item) => !item.is_read) : items;

  function openNotification(item) {
    if (!item.is_read) markRead(item.id);
    if (item.action_url) navigate(item.action_url);
    else if (item.write_off_id) navigate(role === ROLE_SENDER ? `/my-requests/${item.write_off_id}` : `/review/${item.write_off_id}`);
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow={p.platform}
        title={p.notifications}
        subtitle="Изменения по задачам, сменам и рабочим обращениям"
        action={unread > 0 ? <PlatformButton variant="soft" icon="checkCircle" onClick={markAllRead}>Прочитать всё</PlatformButton> : null}
      />

      <div className="mt-5 inline-flex rounded-2xl border border-line bg-surface p-1 shadow-card-sm" role="tablist" aria-label="Фильтр уведомлений">
        {[
          ['all', 'Все', items.length],
          ['unread', 'Новые', unread],
        ].map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`min-h-10 cursor-pointer rounded-xl px-4 text-[12px] font-bold transition-colors active:scale-[.98] ${filter === value ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface2'}`}>
            {label} <span className="ml-1 opacity-75">{count}</span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <PlatformCard className="grid min-h-64 place-items-center"><Spinner size={30} /></PlatformCard>
        ) : error ? (
          <PlatformCard className="grid min-h-64 place-items-center p-6 text-center">
            <div>
              <IconTile icon="alertTriangle" tone="red" />
              <h2 className="mb-2 mt-4 font-head text-[22px] font-semibold text-text">Не удалось загрузить уведомления</h2>
              <p className="m-0 max-w-sm text-[13px] leading-relaxed text-muted">{error}</p>
              <PlatformButton className="mt-5" icon="refresh" onClick={() => fetchList({ per_page: 50 })}>Попробовать снова</PlatformButton>
            </div>
          </PlatformCard>
        ) : filtered.length === 0 ? (
          <EmptyPlatformState icon="bell" title={filter === 'unread' ? 'Новых уведомлений нет' : 'Уведомлений пока нет'} subtitle="Когда появятся изменения по вашим рабочим процессам, они будут собраны здесь." />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => openNotification(item)} className={`flex min-h-[88px] w-full cursor-pointer items-center gap-3.5 rounded-[22px] border bg-surface p-4 text-left shadow-card-sm transition-[border-color,background-color,transform] hover:bg-surface2 active:scale-[.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${item.is_read ? 'border-line' : 'border-green'}`}>
                <IconTile icon={item.write_off_id ? 'clipboard' : 'bell'} tone={item.is_read ? 'neutral' : 'green'} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-text">{item.title}</span>
                    {!item.is_read && <StatusPill>Новое</StatusPill>}
                  </span>
                  {item.body && <span className="mt-1 block text-[12px] leading-relaxed text-muted">{item.body}</span>}
                  <span className="mt-1.5 block text-[11px] text-faint">{dateLabel(item.created_at, lang)}</span>
                </span>
                <Icon name="chevronRight" size={18} className="flex-none text-faint" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
