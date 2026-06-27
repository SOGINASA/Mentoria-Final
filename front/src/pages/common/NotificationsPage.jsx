import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import PhotoTile from '../../components/ui/PhotoTile';
import Icon from '../../components/ui/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { useNotifyStore } from '../../store/notifyStore';
import { ROLE_SENDER } from '../../constants/roles';
import { dateLabel } from '../../utils/format';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const role = useAuthStore((s) => s.user?.role);
  const { items, loading, unread, fetchList, markRead, markAllRead } = useNotifyStore();

  useEffect(() => {
    fetchList({ per_page: 50 });
  }, [fetchList]);

  const open = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.write_off_id) {
      // отправитель идёт к своему черновику/заявке, проверяющий — в очередь
      navigate(role === ROLE_SENDER ? `/my-requests/${n.write_off_id}` : `/review/${n.write_off_id}`);
    }
  };

  return (
    <div className="p-5 max-w-[760px] mx-auto">
      {unread > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={markAllRead}
            className="border-none bg-transparent text-green font-semibold text-[13px] cursor-pointer"
          >
            {t.notif_read_all}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title={t.notif_empty} subtitle={t.notif_empty_sub} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} lang={lang} onClick={() => open(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, lang, onClick }) {
  const photo = n.write_off?.photo_url;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3.5 bg-surface border rounded-2xl p-3 text-left cursor-pointer w-full
        shadow-card-sm hover:-translate-y-0.5 hover:shadow-card transition"
      style={{ borderColor: n.is_read ? 'var(--line)' : 'var(--green)' }}
    >
      {photo ? (
        <PhotoTile url={photo} className="w-[54px] h-[54px] flex-none" iconSize={22} />
      ) : (
        <span
          className="w-[54px] h-[54px] flex-none rounded-xl grid place-items-center"
          style={{ background: 'var(--amber-tint)', color: 'var(--amber)' }}
        >
          <Icon name="bell" size={24} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {!n.is_read && <span className="w-2 h-2 rounded-full flex-none" style={{ background: 'var(--green)' }} />}
          <div className="font-semibold text-[14px] text-text truncate">{n.title}</div>
        </div>
        {n.body && <div className="text-[12.5px] text-muted mt-0.5 truncate">{n.body}</div>}
        <div className="text-[11.5px] text-faint mt-0.5">{dateLabel(n.created_at, lang)}</div>
      </div>
      <Icon name="chevronRight" size={18} strokeWidth={2.2} className="self-center text-faint flex-none" />
    </button>
  );
}
