import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as financeApi from '../../api/finance.api';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useUiStore } from '../../store/uiStore';
import PlatformModal from '../components/PlatformModal';
import {
  EmptyPlatformState, IconTile, PageIntro, PlatformButton, PlatformCard,
  PlatformField, ProgressBar, StatusPill,
} from '../components/PlatformUi';
import { PLATFORM_ROUTES } from '../platformConfig';

const TABS = [
  { id: 'overview', label: 'Сводка', icon: 'pieChart' },
  { id: 'employees', label: 'Сотрудники', icon: 'users' },
  { id: 'stores', label: 'Точки', icon: 'store' },
];

const EMPTY = { stores: [], employees: [], analytics: { stores: [] }, payroll_connected: false };

function currentMonth() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 7);
}

function hours(minutes = 0) {
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function readiness(status) {
  const values = {
    ready: { label: 'Готово', tone: 'green' },
    attention: { label: 'Нужна проверка', tone: 'orange' },
    no_data: { label: 'Нет табелей', tone: 'neutral' },
  };
  return values[status] || values.no_data;
}

export default function PlatformFinancePage() {
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const [workspace, setWorkspace] = useState(EMPTY);
  const [month, setMonth] = useState(currentMonth());
  const [storeId, setStoreId] = useState('all');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWorkspace(await financeApi.getWorkspace({ month, storeId }));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить финансовые данные');
    } finally {
      setLoading(false);
    }
  }, [month, storeId]);

  useEffect(() => { reload(); }, [reload]);

  const employees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? workspace.employees.filter((item) => item.full_name.toLowerCase().includes(query)) : workspace.employees;
  }, [search, workspace.employees]);

  async function exportHours() {
    setExporting(true);
    try {
      const csv = await financeApi.exportConfirmedHours({ month, storeId });
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bahandi-hours-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Выгрузка подтверждённых часов готова');
    } catch (requestError) {
      showToast(requestError.message || 'Не удалось сформировать выгрузку');
    } finally {
      setExporting(false);
    }
  }

  const analytics = workspace.analytics || EMPTY.analytics;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow="Финансовый контур" title="Расчёт рабочего времени" subtitle="Сверяйте подтверждённые табели и готовьте проверенные часы к передаче в payroll." action={<PlatformButton icon="download" loading={exporting} disabled={!analytics.approved_minutes} onClick={exportHours}>Выгрузить CSV</PlatformButton>} />

      <PlatformCard className="mt-5 p-4" variant="orangeTint"><div className="flex items-start gap-3"><Icon name="info" size={20} className="mt-0.5 flex-none text-orange" /><div><div className="text-[12px] font-bold text-text">Расчёт сумм пока не выполняется</div><div className="mt-1 text-[11px] leading-relaxed text-muted">В системе нет проверенного источника ставок, надбавок и удержаний. Finance получает только фактические часы; официальный payroll подключается отдельной интеграцией.</div></div></div></PlatformCard>

      {error ? <PlatformCard className="mt-5 p-5" variant="orangeTint"><div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold text-text">Данные периода не загрузились</div><div className="mt-1 text-[12px] text-muted">{error}</div></div><PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton></div></PlatformCard> : <>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon="clock" label="Подтверждено" value={hours(analytics.approved_minutes)} meta="можно выгружать" />
          <Metric icon="history" label="На проверке" value={hours(analytics.pending_minutes)} meta="ещё не входит в расчёт" tone="orange" />
          <Metric icon="users" label="Готовность" value={`${analytics.readiness_percent || 0}%`} meta={`${analytics.ready_employees || 0} сотрудников готовы`} />
          <Metric icon="alertTriangle" label="Расхождения" value={analytics.attention_employees || 0} meta={`${analytics.pending_corrections || 0} корректировок`} tone="orange" />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="grid flex-1 grid-cols-3 gap-1 rounded-[20px] border border-line bg-surface p-1.5 shadow-card-sm" role="tablist" aria-label="Финансовый кабинет">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === item.id ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface2 hover:text-text'}`}><Icon name={item.icon} size={18} /><span className="hidden sm:inline">{item.label}</span></button>)}</div><div className="grid w-full grid-cols-2 gap-3 sm:w-auto"><div className="sm:w-44"><PlatformField type="month" label="Период" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className="sm:w-56"><PlatformField as="select" label="Торговая точка" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="all">Все точки</option>{workspace.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField></div></div></div>

        <div key={tab} className="platform-content-swap mt-5">{loading ? <div className="grid min-h-64 place-items-center"><Spinner size={30} /></div> : <>
          {tab === 'overview' && <FinanceOverview analytics={analytics} employees={workspace.employees} stores={workspace.stores} onEmployee={setSelectedEmployee} onCases={() => navigate(PLATFORM_ROUTES.support)} />}
          {tab === 'employees' && <Employees employees={employees} stores={workspace.stores} search={search} onSearch={setSearch} onSelect={setSelectedEmployee} />}
          {tab === 'stores' && <StoreBreakdown stores={analytics.stores || []} />}
        </>}</div>
      </>}

      <PlatformModal open={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} title={selectedEmployee?.full_name || 'Сотрудник'} subtitle={selectedEmployee?.worked_store_ids?.length > 1 ? 'Несколько точек' : workspace.stores.find((store) => store.id === selectedEmployee?.store_id)?.name || 'Точка не указана'} footer={<PlatformButton onClick={() => setSelectedEmployee(null)}>Закрыть</PlatformButton>}>
        {selectedEmployee && <EmployeeDetails employee={selectedEmployee} />}
      </PlatformModal>
    </div>
  );
}

function Metric({ icon, label, value, meta, tone = 'green' }) {
  return <PlatformCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><IconTile icon={icon} tone={tone} size="sm" /><span className="text-right font-head text-[24px] font-semibold tabular-nums text-text sm:text-[27px]">{value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{label}</div><div className="mt-1 text-[10px] text-muted sm:text-[11px]">{meta}</div></PlatformCard>;
}

function FinanceOverview({ analytics, employees, stores, onEmployee, onCases }) {
  const attention = employees.filter((item) => item.readiness === 'attention');
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><section><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Требуют сверки</h3><div className="mt-1 text-[11px] text-muted">Табели не попадут в выгрузку до подтверждения</div></div><StatusPill tone="orange">{attention.length}</StatusPill></div>{attention.length ? <div className="grid gap-3 sm:grid-cols-2">{attention.slice(0, 8).map((employee) => <EmployeeCard key={employee.id} employee={employee} store={stores.find((store) => store.id === employee.store_id)} onClick={() => onEmployee(employee)} />)}</div> : <EmptyPlatformState icon="checkCircle" title="Расхождений нет" subtitle="Все доступные табели готовы или ожидают появления данных." />}</section><aside className="space-y-4"><PlatformCard className="p-5"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Статус периода</h3><div className="mt-5"><ProgressBar value={analytics.readiness_percent || 0} label="Сотрудников готовы к выгрузке" /></div><div className="mt-4 grid grid-cols-2 gap-2"><Summary value={analytics.ready_employees || 0} label="готовы" /><Summary value={analytics.no_data_employees || 0} label="без данных" /></div></PlatformCard><button type="button" onClick={onCases} className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-colors hover:border-green"><IconTile icon="helpCircle" tone="orange" size="sm" /><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-text">Вопросы по начислениям</span><span className="mt-1 block text-[10px] text-muted">Ответить сотрудникам</span></span><Icon name="chevronRight" size={18} className="text-faint" /></button></aside></div>;
}

function Employees({ employees, stores, search, onSearch, onSelect }) {
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Табели сотрудников</h3><p className="mb-0 mt-1 text-[11px] text-muted">Подтверждённое время и состояние проверки</p></div><div className="w-full sm:w-80"><PlatformField label="Поиск сотрудника" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Введите ФИО" /></div></div>{employees.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => <EmployeeCard key={employee.id} employee={employee} store={stores.find((store) => store.id === employee.store_id)} onClick={() => onSelect(employee)} />)}</div> : <EmptyPlatformState icon="users" title="Сотрудники не найдены" subtitle="Измените поисковый запрос или фильтр точки." />}</div>;
}

function EmployeeCard({ employee, store, onClick }) {
  const status = readiness(employee.readiness);
  const storeLabel = employee.worked_store_ids?.length > 1 ? 'Несколько точек' : store?.name || 'Точка не указана';
  return <button type="button" onClick={onClick} className="cursor-pointer rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-colors hover:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-[13px] font-bold text-text">{employee.full_name}</span><span className="mt-1 block truncate text-[10px] text-muted">{[employee.position, storeLabel].filter(Boolean).join(' · ')}</span></span><StatusPill tone={status.tone}>{employee.has_account === false ? 'Нет аккаунта' : status.label}</StatusPill></div><div className="mt-4 grid grid-cols-2 gap-2"><Summary value={hours(employee.approved_minutes)} label="подтверждено" small /><Summary value={hours(employee.pending_minutes)} label="на проверке" small /></div></button>;
}

function EmployeeDetails({ employee }) {
  const status = readiness(employee.readiness);
  return <div className="space-y-4"><div className="flex items-center justify-between rounded-2xl bg-surface2 p-4"><span className="text-[12px] font-bold text-text">Готовность к расчёту</span><StatusPill tone={status.tone}>{employee.has_account === false ? 'Нет аккаунта' : status.label}</StatusPill></div>{employee.position && <div className="rounded-2xl border border-line p-4 text-[12px] text-muted">Должность: <span className="font-semibold text-text">{employee.position}</span></div>}<div className="grid grid-cols-2 gap-3"><Summary value={hours(employee.approved_minutes)} label="подтверждено" /><Summary value={hours(employee.pending_minutes)} label="ожидает проверки" /></div><div className="rounded-2xl border border-line p-4"><div className="text-[11px] font-bold text-text">Табели периода</div><div className="mt-3 space-y-2"><StatusLine label="Подтверждено" value={employee.approved_timecards} /><StatusLine label="На проверке" value={employee.pending_timecards} /><StatusLine label="Отклонено" value={employee.rejected_timecards} /><StatusLine label="Открыто" value={employee.open_timecards} /></div></div></div>;
}

function StoreBreakdown({ stores }) {
  const max = Math.max(...stores.map((item) => item.approved_minutes), 1);
  return <div><h3 className="mb-4 mt-0 font-head text-[20px] font-semibold text-text">Готовность по точкам</h3>{stores.length ? <div className="grid gap-3 lg:grid-cols-2">{stores.map((store) => <PlatformCard key={store.store_id} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-bold text-text">{store.name}</div><div className="mt-1 text-[10px] text-muted">{store.employees} сотрудников · {store.attention_employees} требуют сверки</div></div><span className="font-head text-[20px] font-semibold tabular-nums text-text">{hours(store.approved_minutes)}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-green" style={{ width: `${store.approved_minutes / max * 100}%` }} /></div><div className="mt-3 flex items-center justify-between text-[10px] text-muted"><span>Готово: {store.ready_employees}</span><span>На проверке: {hours(store.pending_minutes)}</span></div></PlatformCard>)}</div> : <EmptyPlatformState icon="store" title="Нет данных по точкам" subtitle="Табели появятся после отметок сотрудников." />}</div>;
}

function Summary({ value, label, small = false }) {
  return <div className="rounded-2xl bg-surface2 p-3"><div className={`font-head font-semibold tabular-nums text-text ${small ? 'text-[16px]' : 'text-[22px]'}`}>{value}</div><div className="mt-1 text-[10px] text-muted">{label}</div></div>;
}

function StatusLine({ label, value }) {
  return <div className="flex min-h-9 items-center justify-between border-b border-line2 text-[11px] last:border-0"><span className="text-muted">{label}</span><span className="font-bold tabular-nums text-text">{value}</span></div>;
}
