import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { listAudit } from '../../api/admin.api';
import { useUiStore } from '../../store/uiStore';

const ACTION_NAMES = {
  'user.scopes_replaced': 'Изменены доступы по точкам',
  'feature_flag.updated': 'Изменена доступность функции',
  'shift.created': 'Создана смена', 'shift.updated': 'Изменена смена',
  'task.created': 'Создана задача', 'task.updated': 'Изменена задача',
  'news.created': 'Опубликована новость', 'case.updated': 'Обработано обращение',
};

export default function AuditPanel() {
  const showToast = useUiStore((state) => state.showToast);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await listAudit({ page, per_page: 25, action: filter.trim() });
      setEvents(data.events || []); setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) { showToast(error.message || 'Не удалось загрузить журнал'); }
    finally { setLoading(false); }
  }, [filter, showToast]);
  useEffect(() => { const timer = setTimeout(() => load(1), 250); return () => clearTimeout(timer); }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block flex-1 sm:max-w-[420px]"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Фильтр по действию, например shift" className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-text outline-none transition focus:border-green" /></label>
        <span className="text-[12px] text-muted">{pagination.total} событий</span>
      </div>
      {loading ? <div className="grid place-items-center py-20"><Spinner /></div> : events.length === 0 ? <EmptyState icon="history" title="Событий не найдено" /> : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card-sm">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3 border-b border-line p-4 last:border-b-0">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-surface2 text-muted"><Icon name="history" size={18} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-bold text-text">{ACTION_NAMES[event.action] || event.action}</div><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11.5px] text-muted"><span>{event.actor_name || (event.actor_id ? `Пользователь #${event.actor_id}` : 'Система')}</span><span>·</span><span>{new Date(event.created_at).toLocaleString('ru-KZ')}</span>{event.store_name && <><span>·</span><span>{event.store_name}</span></>}</div></div>
              <span className="hidden rounded-lg bg-surface2 px-2 py-1 text-[10.5px] text-faint sm:block">{event.entity_type}{event.entity_id ? ` #${event.entity_id}` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {pagination.pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-text disabled:opacity-40"><Icon name="chevronLeft" /></button><span className="text-xs text-muted">{pagination.page} из {pagination.pages}</span><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-text disabled:opacity-40"><Icon name="chevronRight" /></button></div>}
    </div>
  );
}
