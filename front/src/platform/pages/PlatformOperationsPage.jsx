import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as operationsApi from '../../api/operations.api';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import PlatformModal from '../components/PlatformModal';
import {
  EmptyPlatformState, IconTile, PageIntro, PlatformButton, PlatformCard,
  PlatformField, ProgressBar, StatusPill,
} from '../components/PlatformUi';
import { PLATFORM_ROUTES } from '../platformConfig';

const TABS = [
  { id: 'overview', label: 'Обзор', icon: 'pieChart' },
  { id: 'alerts', label: 'Отклонения', icon: 'alertTriangle' },
  { id: 'stores', label: 'Точки', icon: 'store' },
  { id: 'trend', label: 'Динамика', icon: 'history' },
];

const EMPTY = { stores: [], store_summaries: [], alerts: [], analytics: {}, trend: [] };

function alertConfig(kind) {
  const values = {
    coverage: { icon: 'users', label: 'Покрытие смен' },
    tasks: { icon: 'clipboard', label: 'Задачи' },
    timecards: { icon: 'clock', label: 'Табели' },
    cases: { icon: 'helpCircle', label: 'Обращения' },
  };
  return values[kind] || { icon: 'alertTriangle', label: 'Отклонение' };
}

export default function PlatformOperationsPage() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(EMPTY);
  const [days, setDays] = useState('14');
  const [storeId, setStoreId] = useState('all');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWorkspace(await operationsApi.getWorkspace({ days, storeId }));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить операционные данные');
    } finally {
      setLoading(false);
    }
  }, [days, storeId]);

  useEffect(() => { reload(); }, [reload]);

  const analytics = workspace.analytics || {};
  const attentionStores = useMemo(() => workspace.store_summaries.filter((item) => item.attention_count > 0), [workspace.store_summaries]);

  function openAction(alert) {
    navigate(`${alert.action_url}?store_id=${alert.store_id}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1300px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow="Операционный офис" title="Центр управления сетью" subtitle="Контролируйте работу точек по отклонениям и переходите сразу к процессу, который требует решения." action={<PlatformButton variant="secondary" icon="refresh" loading={loading} onClick={reload}>Обновить</PlatformButton>} />

      {error ? <PlatformCard className="mt-6 p-5" variant="orangeTint"><div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold text-text">Операционные данные не загрузились</div><div className="mt-1 text-[12px] text-muted">{error}</div></div><PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton></div></PlatformCard> : <>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon="store" label="Активные точки" value={analytics.active_stores || 0} meta={`${analytics.active_employees || 0} сотрудников`} />
          <Metric icon="users" label="Покрытие смен" value={analytics.uncovered_slots || 0} meta={`${analytics.today_shifts || 0} смен сегодня`} tone={analytics.uncovered_slots ? 'orange' : 'green'} />
          <Metric icon="clipboard" label="Просрочено задач" value={analytics.overdue_tasks || 0} meta={`${analytics.task_completion_percent || 0}% выполнено за период`} tone={analytics.overdue_tasks ? 'orange' : 'green'} />
          <Metric icon="queue" label="Ожидают решения" value={(analytics.submitted_timecards || 0) + (analytics.open_cases || 0)} meta={`${analytics.submitted_timecards || 0} табелей · ${analytics.open_cases || 0} обращений`} tone="orange" />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="grid flex-1 grid-cols-4 gap-1 rounded-[20px] border border-line bg-surface p-1.5 shadow-card-sm" role="tablist" aria-label="Операционный центр">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-2xl px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === item.id ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface2 hover:text-text'}`}><Icon name={item.icon} size={18} /><span className="hidden md:inline">{item.label}</span></button>)}</div><div className="grid w-full grid-cols-2 gap-3 sm:w-auto"><div className="sm:w-44"><PlatformField as="select" label="Период" value={days} onChange={(event) => setDays(event.target.value)}><option value="7">7 дней</option><option value="14">14 дней</option><option value="30">30 дней</option></PlatformField></div><div className="sm:w-60"><PlatformField as="select" label="Торговая точка" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="all">Вся сеть</option>{workspace.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField></div></div></div>

        <div key={tab} className="platform-content-swap mt-5">{loading ? <div className="grid min-h-64 place-items-center"><Spinner size={30} /></div> : <>
          {tab === 'overview' && <OperationsOverview alerts={workspace.alerts} stores={attentionStores} analytics={analytics} onAction={openAction} onStore={setSelectedStore} onManagement={() => navigate(PLATFORM_ROUTES.management)} onApprovals={() => navigate(PLATFORM_ROUTES.approvals)} onNews={() => navigate(PLATFORM_ROUTES.news)} />}
          {tab === 'alerts' && <Alerts alerts={workspace.alerts} onAction={openAction} />}
          {tab === 'stores' && <Stores stores={workspace.store_summaries} onSelect={setSelectedStore} />}
          {tab === 'trend' && <Trend data={workspace.trend} analytics={analytics} />}
        </>}</div>
      </>}

      <PlatformModal open={Boolean(selectedStore)} onClose={() => setSelectedStore(null)} title={selectedStore?.name || 'Торговая точка'} subtitle={selectedStore?.address || 'Операционная сводка'} footer={<><PlatformButton variant="secondary" onClick={() => setSelectedStore(null)}>Закрыть</PlatformButton><PlatformButton icon="briefcase" onClick={() => navigate(`${PLATFORM_ROUTES.management}?store_id=${selectedStore?.store_id}`)}>Управление точкой</PlatformButton></>}>
        {selectedStore && <StoreDetails store={selectedStore} />}
      </PlatformModal>
    </div>
  );
}

function Metric({ icon, label, value, meta, tone = 'green' }) {
  return <PlatformCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><IconTile icon={icon} tone={tone} size="sm" /><span className="font-head text-[29px] font-semibold tabular-nums text-text">{value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{label}</div><div className="mt-1 text-[10px] text-muted sm:text-[11px]">{meta}</div></PlatformCard>;
}

function OperationsOverview({ alerts, stores, analytics, onAction, onStore, onManagement, onApprovals, onNews }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]"><section><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Приоритетные отклонения</h3><div className="mt-1 text-[11px] text-muted">Сначала показаны незакрытые смены и массовые проблемы</div></div><StatusPill tone="orange">{alerts.length}</StatusPill></div>{alerts.length ? <div className="grid gap-3 sm:grid-cols-2">{alerts.slice(0, 8).map((alert) => <AlertCard key={alert.id} alert={alert} onClick={() => onAction(alert)} />)}</div> : <EmptyPlatformState icon="checkCircle" title="Критичных отклонений нет" subtitle="Все основные операционные процессы находятся в нормальном состоянии." />}<div className="mt-6"><h3 className="mb-3 font-head text-[20px] font-semibold text-text">Точки, требующие внимания</h3><div className="grid gap-3 sm:grid-cols-2">{stores.slice(0, 6).map((store) => <StoreCard key={store.store_id} store={store} onClick={() => onStore(store)} />)}{!stores.length && <div className="sm:col-span-2"><EmptyPlatformState icon="store" title="По точкам нет отклонений" subtitle="Очереди и покрытие смен в порядке." /></div>}</div></div></section><aside className="space-y-4"><PlatformCard className="p-5"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Быстрые действия</h3><div className="mt-4 grid gap-2"><PlatformButton icon="briefcase" onClick={onManagement}>Управление точками</PlatformButton><PlatformButton variant="secondary" icon="queue" onClick={onApprovals}>Центр согласований</PlatformButton><PlatformButton variant="secondary" icon="send" onClick={onNews}>Опубликовать новость</PlatformButton></div></PlatformCard><PlatformCard className="p-5"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Сводка периода</h3><div className="mt-4 grid grid-cols-2 gap-2"><Summary value={analytics.tasks_completed || 0} label="задач выполнено" /><Summary value={analytics.writeoffs || 0} label="списаний" /><Summary value={analytics.open_timecards || 0} label="открытых табелей" /><Summary value={analytics.open_cases || 0} label="обращений" /></div></PlatformCard></aside></div>;
}

function Alerts({ alerts, onAction }) {
  return <div><div className="mb-4"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Все отклонения</h3><p className="mb-0 mt-1 text-[11px] text-muted">Каждая карточка ведёт в раздел, где можно принять решение</p></div>{alerts.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onClick={() => onAction(alert)} />)}</div> : <EmptyPlatformState icon="checkCircle" title="Отклонений нет" subtitle="Новых операционных рисков не обнаружено." />}</div>;
}

function AlertCard({ alert, onClick }) {
  const config = alertConfig(alert.kind);
  return <button type="button" onClick={onClick} className={`min-h-28 cursor-pointer rounded-[22px] border bg-surface p-4 text-left shadow-card-sm transition-[border-color,transform] active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${alert.severity === 'critical' ? 'border-orange' : 'border-line hover:border-green'}`}><div className="flex items-start gap-3"><IconTile icon={config.icon} tone={alert.severity === 'critical' ? 'orange' : 'amber'} size="sm" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><StatusPill tone={alert.severity === 'critical' ? 'orange' : 'amber'}>{config.label}</StatusPill><span className="font-head text-[21px] font-semibold tabular-nums text-text">{alert.count}</span></span><span className="mt-3 block text-[12px] font-bold text-text">{alert.title}</span><span className="mt-1 block truncate text-[10px] text-muted">{alert.store_name}</span></span></div></button>;
}

function Stores({ stores, onSelect }) {
  return <div><div className="mb-4"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Состояние торговых точек</h3><p className="mb-0 mt-1 text-[11px] text-muted">Сортировка по количеству активных отклонений</p></div>{stores.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{stores.map((store) => <StoreCard key={store.store_id} store={store} onClick={() => onSelect(store)} />)}</div> : <EmptyPlatformState icon="store" title="Точки не найдены" subtitle="Нет доступных торговых точек для отображения." />}</div>;
}

function StoreCard({ store, onClick }) {
  return <button type="button" onClick={onClick} className="cursor-pointer rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-colors hover:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-[13px] font-bold text-text">{store.name}</span><span className="mt-1 block truncate text-[10px] text-muted">{store.team} сотрудников · {store.today_shifts} смен сегодня</span></span><StatusPill tone={store.attention_count ? 'orange' : 'green'}>{store.attention_count ? `${store.attention_count} сигналов` : 'В норме'}</StatusPill></div><div className="mt-4 grid grid-cols-3 gap-2"><SmallValue value={store.uncovered_slots} label="мест" /><SmallValue value={store.overdue_tasks} label="задач" /><SmallValue value={store.open_cases} label="обращ." /></div></button>;
}

function StoreDetails({ store }) {
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Summary value={store.team} label="сотрудников" /><Summary value={store.today_shifts} label="смен сегодня" /></div><div className="rounded-2xl border border-line p-4"><StatusLine label="Незакрытые места" value={store.uncovered_slots} /><StatusLine label="Просроченные задачи" value={store.overdue_tasks} /><StatusLine label="Табели на проверке" value={store.submitted_timecards} /><StatusLine label="Открытые обращения" value={store.open_cases} /><StatusLine label="Списания за период" value={store.writeoffs} /></div></div>;
}

function Trend({ data, analytics }) {
  const max = Math.max(...data.flatMap((item) => [item.completed_tasks, item.writeoffs]), 1);
  return <div><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Динамика процессов</h3><p className="mb-0 mt-1 text-[11px] text-muted">Выполненные задачи и списания по дням</p></div><div className="flex gap-4 text-[10px] text-muted"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-green" />Задачи</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange" />Списания</span></div></div><PlatformCard className="min-w-0 p-5"><div className="overflow-x-auto pb-1"><div className="flex h-56 items-end gap-2" style={{ minWidth: `${Math.max(620, data.length * 26)}px` }} role="img" aria-label="Динамика выполненных задач и списаний">{data.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="flex h-full items-end justify-center gap-0.5"><div title={`Задачи: ${item.completed_tasks}`} className="w-2/5 rounded-t bg-green" style={{ height: `${Math.max(2, item.completed_tasks / max * 100)}%` }} /><div title={`Списания: ${item.writeoffs}`} className="w-2/5 rounded-t bg-orange" style={{ height: `${Math.max(2, item.writeoffs / max * 100)}%` }} /></div><span className="mt-2 text-center text-[9px] text-faint">{new Date(`${item.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span></div>)}</div></div></PlatformCard><div className="mt-4"><ProgressBar value={analytics.task_completion_percent || 0} label={`${analytics.tasks_completed || 0} из ${analytics.tasks_created || 0} задач выполнено`} /></div></div>;
}

function Summary({ value, label }) {
  return <div className="rounded-2xl bg-surface2 p-3"><div className="font-head text-[22px] font-semibold tabular-nums text-text">{value}</div><div className="mt-1 text-[10px] text-muted">{label}</div></div>;
}

function SmallValue({ value, label }) {
  return <div className="rounded-xl bg-surface2 p-2.5 text-center"><div className="font-head text-[18px] font-semibold tabular-nums text-text">{value}</div><div className="mt-0.5 text-[9px] text-muted">{label}</div></div>;
}

function StatusLine({ label, value }) {
  return <div className="flex min-h-10 items-center justify-between border-b border-line2 text-[11px] last:border-0"><span className="text-muted">{label}</span><span className="font-bold tabular-nums text-text">{value}</span></div>;
}
