import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as managerApi from '../../api/manager.api';
import * as writeOffsApi from '../../api/writeOffs.api';
import Icon from '../../components/ui/Icon';
import PhotoTile from '../../components/ui/PhotoTile';
import Spinner from '../../components/ui/Spinner';
import {
  EmptyPlatformState,
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  PlatformField,
  StatusPill,
} from '../components/PlatformUi';
import { PLATFORM_ROUTES } from '../platformConfig';

const EMPTY_QUEUE = {
  shift_requests: [], time_corrections: [], timecards: [], tasks: [],
  document_requests: [], leave_requests: [],
};

const WRITEOFFS_PER_PAGE = 20;

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function sumQueue(queue) {
  return Object.values(queue).reduce((total, items) => total + items.length, 0);
}

export default function PlatformReviewerPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('queue');
  const [storeId, setStoreId] = useState('all');
  const [page, setPage] = useState(1);
  const [days, setDays] = useState('30');
  const [data, setData] = useState({
    stores: [], writeOffs: [], pagination: null, queue: EMPTY_QUEUE, analytics: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        status: 'pending', sort: 'oldest', page, per_page: WRITEOFFS_PER_PAGE,
      };
      const analyticsParams = { days };
      if (storeId !== 'all') {
        params.store_id = storeId;
        analyticsParams.store_id = storeId;
      }
      const [workspace, queue, writeOffs, analytics] = await Promise.all([
        managerApi.getWorkspace(), managerApi.getTodayQueue(),
        writeOffsApi.listWriteOffs(params), writeOffsApi.getAnalytics(analyticsParams),
      ]);
      setData({
        stores: workspace.stores || [], queue: { ...EMPTY_QUEUE, ...queue },
        writeOffs: writeOffs.write_offs || [], pagination: writeOffs.pagination || null, analytics,
      });
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить данные контроля');
    } finally {
      setLoading(false);
    }
  }, [days, page, storeId]);

  useEffect(() => { reload(); }, [reload]);

  const approvalCount = useMemo(() => sumQueue(data.queue), [data.queue]);
  const selectedStore = data.stores.find((store) => String(store.id) === storeId);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow="Кабинет проверяющего"
        title="Контроль точек"
        subtitle="Списания, операционные согласования и показатели закреплённых точек в одной очереди."
        action={<PlatformButton variant="secondary" icon="refresh" loading={loading} onClick={reload}>Обновить</PlatformButton>}
      />

      {error ? <PlatformCard className="mt-6 p-5" variant="orangeTint"><div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold text-text">Рабочее пространство не загрузилось</div><div className="mt-1 text-[12px] text-muted">{error}</div></div><PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton></div></PlatformCard> : <>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon="queue" label="Списания" value={data.pagination?.total ?? data.writeOffs.length} meta="ожидают решения" tone="orange" />
          <Metric icon="clipboard" label="Согласования" value={approvalCount} meta="в операционной очереди" />
          <Metric icon="store" label="Точки" value={data.stores.length} meta="в зоне контроля" />
          <Metric icon="history" label="Отклонено" value={data.analytics?.totals?.rejected || 0} meta={`за ${days} дней`} tone="orange" />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3 shadow-card-sm sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-surface2 p-1" role="tablist" aria-label="Раздел контроля">
            <Tab active={tab === 'queue'} icon="queue" onClick={() => setTab('queue')}>Очередь</Tab>
            <Tab active={tab === 'analytics'} icon="pieChart" onClick={() => setTab('analytics')}>Аналитика</Tab>
          </div>
          <div className="w-full sm:w-64"><PlatformField as="select" label="Торговая точка" value={storeId} onChange={(event) => { setPage(1); setStoreId(event.target.value); }}><option value="all">Все закреплённые точки</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField></div>
        </div>

        <div key={tab} className="platform-content-swap mt-5">
          {loading ? <div className="grid min-h-64 place-items-center"><Spinner size={30} /></div> : tab === 'queue'
            ? <ReviewQueue writeOffs={data.writeOffs} pagination={data.pagination} page={page} queue={data.queue} stores={data.stores} onPage={setPage} onOpenWriteOff={(id) => navigate(`/review/${id}`)} onApprovals={() => navigate(PLATFORM_ROUTES.approvals)} onHistory={() => navigate('/review/history')} />
            : <ReviewerAnalytics data={data.analytics} days={days} onDays={setDays} storeName={selectedStore?.name} />}
        </div>
      </>}
    </div>
  );
}

function Tab({ active, icon, children, onClick }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${active ? 'bg-brand text-on-brand shadow-card-sm' : 'text-muted hover:text-text'}`}><Icon name={icon} size={18} />{children}</button>;
}

function Metric({ icon, label, value, meta, tone = 'green' }) {
  return <PlatformCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><IconTile icon={icon} tone={tone} size="sm" /><span className="font-head text-[29px] font-semibold tabular-nums text-text">{value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{label}</div><div className="mt-1 text-[10px] text-muted sm:text-[11px]">{meta}</div></PlatformCard>;
}

function ReviewQueue({ writeOffs, pagination, page, queue, stores, onPage, onOpenWriteOff, onApprovals, onHistory }) {
  const operational = [
    ['timecards', 'Табели', 'clock'], ['time_corrections', 'Корректировки', 'history'],
    ['tasks', 'Задачи', 'clipboard'], ['shift_requests', 'Запросы смен', 'calendar'],
  ];
  const total = pagination?.total ?? writeOffs.length;
  const pages = pagination?.pages || 1;
  const perPage = pagination?.per_page || WRITEOFFS_PER_PAGE;
  const firstItem = total ? (page - 1) * perPage + 1 : 0;
  const lastItem = Math.min(page * perPage, total);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><section><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Списания на проверку</h3><div className="mt-1 text-[11px] text-muted">Сначала рассматривайте самые ранние заявки</div></div><PlatformButton variant="secondary" icon="history" onClick={onHistory}>История</PlatformButton></div>{writeOffs.length ? <><div className="grid gap-3 sm:grid-cols-2">{writeOffs.map((item) => <button key={item.id} type="button" onClick={() => onOpenWriteOff(item.id)} className="flex min-h-[104px] cursor-pointer gap-3 rounded-[22px] border border-line bg-surface p-3 text-left shadow-card-sm transition-[border-color,transform] hover:border-green active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"><PhotoTile url={item.photos?.[0]?.url} className="h-20 w-20 flex-none" iconSize={25} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-[13px] font-bold text-text">{item.comment || item.category?.name || `Списание #${item.id}`}</span><Icon name="chevronRight" size={17} className="flex-none text-faint" /></span><span className="mt-2 block truncate text-[11px] text-muted">{item.store?.name || stores.find((store) => store.id === item.store_id)?.name || `Точка #${item.store_id}`}</span><span className="mt-1 block text-[10px] text-faint">{formatDate(item.created_at)} · {item.author?.full_name || 'Сотрудник'}</span></span></button>)}</div><div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[11px] text-muted">Показаны {firstItem}–{lastItem} из {total}</span><div className="flex gap-2"><PlatformButton variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Назад</PlatformButton><PlatformButton variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Далее</PlatformButton></div></div></> : <EmptyPlatformState icon="checkCircle" title="Очередь списаний пуста" subtitle="Все поступившие заявки уже обработаны." />}</section><aside className="space-y-4"><PlatformCard className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Операционные проверки</h3><StatusPill tone="orange">{sumQueue(queue)}</StatusPill></div><div className="mt-4 space-y-2">{operational.map(([key, label, icon]) => <button key={key} type="button" onClick={onApprovals} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface2 px-3 text-left transition-colors hover:bg-green-tint"><Icon name={icon} size={18} className="text-green" /><span className="flex-1 text-[12px] font-semibold text-text">{label}</span><span className="font-head text-[17px] font-semibold tabular-nums text-text">{queue[key]?.length || 0}</span></button>)}</div><PlatformButton className="mt-4 w-full" icon="queue" onClick={onApprovals}>Открыть согласования</PlatformButton></PlatformCard><PlatformCard className="p-5" variant="greenTint"><IconTile icon="shieldCheck" tone="green" /><h3 className="mb-0 mt-4 font-head text-[18px] font-semibold text-text">Контроль без потери контекста</h3><p className="mb-0 mt-2 text-[11px] leading-relaxed text-muted">Решение по списанию выполняется в проверенной рабочей форме. Возврат в платформу доступен через кнопку «Система списаний».</p></PlatformCard></aside></div>;
}

function ReviewerAnalytics({ data, days, onDays, storeName }) {
  if (!data) return <EmptyPlatformState icon="pieChart" title="Нет данных для аналитики" subtitle="Выберите другой период или торговую точку." />;
  const maxTrend = Math.max(...(data.trend || []).map((item) => item.count), 1);
  const maxStore = Math.max(...(data.by_store || []).map((item) => item.count), 1);
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Качество списаний{storeName ? ` · ${storeName}` : ''}</h3><p className="mb-0 mt-1 text-[11px] text-muted">Количество, структура и динамика решений</p></div><div className="w-full sm:w-52"><PlatformField as="select" label="Период" value={days} onChange={(event) => onDays(event.target.value)}><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option></PlatformField></div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon="list" label="Всего" value={data.totals?.total || 0} meta="без черновиков" /><Metric icon="checkCircle" label="Подтверждено" value={data.totals?.approved || 0} meta="передано в Iiko" /><Metric icon="close" label="Отклонено" value={data.totals?.rejected || 0} meta="возвращено сотрудникам" tone="orange" /><Metric icon="users" label="С удержанием" value={data.with_hold || 0} meta={`без удержания: ${data.no_hold || 0}`} tone="orange" /></div><div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]"><PlatformCard className="min-w-0 p-5 sm:p-6"><h4 className="m-0 text-[14px] font-bold text-text">Динамика списаний</h4><div className="mt-5 overflow-x-auto pb-1"><div className="flex h-48 items-end gap-1.5" style={{ minWidth: `${Math.max(560, (data.trend?.length || 0) * 18)}px` }} role="img" aria-label="Количество списаний по дням">{data.trend?.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-md bg-green" title={`${item.date}: ${item.count}`} style={{ height: `${Math.max(3, item.count / maxTrend * 100)}%` }} /><span className="mt-2 text-center text-[9px] text-faint">{new Date(`${item.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span></div>)}</div></div></PlatformCard><PlatformCard className="p-5 sm:p-6"><h4 className="m-0 text-[14px] font-bold text-text">Точки по объёму</h4><div className="mt-4 space-y-4">{data.by_store?.map((store) => <div key={store.store_id}><div className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-semibold text-text">{store.name}</span><span className="font-bold tabular-nums text-text">{store.count}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-orange" style={{ width: `${store.count / maxStore * 100}%` }} /></div></div>)}{!data.by_store?.length && <div className="text-[11px] text-muted">За период списаний нет.</div>}</div></PlatformCard></div></div>;
}
