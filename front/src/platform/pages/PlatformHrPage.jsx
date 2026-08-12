import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as hrApi from '../../api/hr.api';
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
  { id: 'people', label: 'Сотрудники', icon: 'users' },
  { id: 'learning', label: 'Обучение', icon: 'book' },
];

const COURSE_NAMES = {
  'service-standards': 'Стандарты сервиса Bahandi',
  'kitchen-safety': 'Безопасность на кухне',
  'shift-lead': 'Основы управления сменой',
};

const EMPTY = {
  stores: [], employees: [],
  requests: { documents: [], leave: [], upcoming_leave: [], open_hr_cases: 0 },
  analytics: { courses: [], stores: [] },
};

function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value.length === 10 ? `${value}T00:00:00` : value));
}

export default function PlatformHrPage() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(EMPTY);
  const [tab, setTab] = useState('overview');
  const [storeId, setStoreId] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWorkspace(await hrApi.getWorkspace(storeId));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить кадровые данные');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { reload(); }, [reload]);

  const employees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workspace.employees || [];
    return workspace.employees.filter((item) => [item.full_name, item.email, item.phone]
      .filter(Boolean).some((value) => value.toLowerCase().includes(query)));
  }, [search, workspace.employees]);

  const analytics = workspace.analytics || EMPTY.analytics;
  const requests = workspace.requests || EMPTY.requests;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow="Кадровый контур" title="HR-кабинет" subtitle="Сотрудники, кадровые запросы, отсутствия и обязательное обучение в одном рабочем пространстве." action={<PlatformButton variant="secondary" icon="refresh" loading={loading} onClick={reload}>Обновить</PlatformButton>} />

      {error ? <PlatformCard className="mt-6 p-5" variant="orangeTint"><div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold text-text">Кадровые данные не загрузились</div><div className="mt-1 text-[12px] text-muted">{error}</div></div><PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton></div></PlatformCard> : <>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon="users" label="Сотрудники" value={analytics.active_employees || 0} meta={`${analytics.on_leave || 0} сейчас отсутствуют`} />
          <Metric icon="fileText" label="Документы" value={analytics.pending_documents || 0} meta="ожидают подготовки" tone="orange" />
          <Metric icon="calendar" label="Отпуска" value={analytics.pending_leave || 0} meta="ожидают решения" tone="orange" />
          <Metric icon="book" label="Обучение" value={`${analytics.learning_compliance || 0}%`} meta="обязательных курсов пройдено" />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-3 gap-1 rounded-[20px] border border-line bg-surface p-1.5 shadow-card-sm" role="tablist" aria-label="HR-кабинет">{TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === item.id ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface2 hover:text-text'}`}><Icon name={item.icon} size={18} /><span className="hidden xs:inline sm:inline">{item.label}</span></button>)}</div>
          <div className="w-full sm:w-64"><PlatformField as="select" label="Торговая точка" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="all">Все торговые точки</option>{workspace.stores?.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField></div>
        </div>

        <div key={tab} className="platform-content-swap mt-5">{loading ? <div className="grid min-h-64 place-items-center"><Spinner size={30} /></div> : <>
          {tab === 'overview' && <HrOverview requests={requests} analytics={analytics} onApprovals={() => navigate(PLATFORM_ROUTES.approvals)} onCases={() => navigate(PLATFORM_ROUTES.support)} onNews={() => navigate(PLATFORM_ROUTES.news)} />}
          {tab === 'people' && <People employees={employees} stores={workspace.stores || []} search={search} onSearch={setSearch} onSelect={setSelectedEmployee} />}
          {tab === 'learning' && <Learning analytics={analytics} />}
        </>}</div>
      </>}

      <PlatformModal open={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} title={selectedEmployee?.full_name || 'Сотрудник'} subtitle={workspace.stores?.find((store) => store.id === selectedEmployee?.store_id)?.name || 'Точка не указана'} footer={<PlatformButton onClick={() => setSelectedEmployee(null)}>Закрыть</PlatformButton>}>
        {selectedEmployee && <EmployeeDetails employee={selectedEmployee} />}
      </PlatformModal>
    </div>
  );
}

function Metric({ icon, label, value, meta, tone = 'green' }) {
  return <PlatformCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><IconTile icon={icon} tone={tone} size="sm" /><span className="font-head text-[28px] font-semibold tabular-nums text-text">{value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{label}</div><div className="mt-1 text-[10px] text-muted sm:text-[11px]">{meta}</div></PlatformCard>;
}

function HrOverview({ requests, analytics, onApprovals, onCases, onNews }) {
  const pending = [
    { label: 'Запросы документов', value: requests.documents?.length || 0, icon: 'fileText', action: onApprovals },
    { label: 'Заявки на отсутствие', value: requests.leave?.length || 0, icon: 'calendar', action: onApprovals },
    { label: 'HR-обращения', value: requests.open_hr_cases || 0, icon: 'helpCircle', action: onCases },
  ];
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]"><section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Требует внимания</h3><StatusPill tone="orange">{pending.reduce((sum, item) => sum + item.value, 0)}</StatusPill></div><div className="grid gap-3 sm:grid-cols-3">{pending.map((item) => <button key={item.label} type="button" onClick={item.action} className="min-h-32 cursor-pointer rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-[border-color,transform] hover:border-green active:scale-[.99]"><div className="flex items-start justify-between gap-3"><IconTile icon={item.icon} tone={item.value ? 'orange' : 'green'} size="sm" /><span className="font-head text-[27px] font-semibold tabular-nums text-text">{item.value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{item.label}</div><div className="mt-1 text-[10px] text-muted">Открыть очередь</div></button>)}</div><div className="mt-5"><h3 className="mb-3 font-head text-[20px] font-semibold text-text">Ближайшие отсутствия</h3>{requests.upcoming_leave?.length ? <div className="grid gap-2">{requests.upcoming_leave.slice(0, 8).map((item) => <PlatformCard key={item.request_id} className="flex items-center gap-3 p-4"><IconTile icon="calendar" tone="amber" size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-text">{item.employee_name}</div><div className="mt-1 text-[10px] text-muted">{formatDay(item.starts_on)} — {formatDay(item.ends_on)} · {item.days} дн.</div></div><StatusPill>{item.leave_type}</StatusPill></PlatformCard>)}</div> : <EmptyPlatformState icon="calendar" title="Ближайших отсутствий нет" subtitle="Согласованные отпуска на следующие 30 дней появятся здесь." />}</div></section><aside className="space-y-4"><PlatformCard className="p-5"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Быстрые действия</h3><div className="mt-4 grid gap-2"><PlatformButton icon="queue" onClick={onApprovals}>Обработать заявки</PlatformButton><PlatformButton variant="secondary" icon="helpCircle" onClick={onCases}>Ответить сотрудникам</PlatformButton><PlatformButton variant="secondary" icon="send" onClick={onNews}>Опубликовать новость</PlatformButton></div></PlatformCard><PlatformCard className="p-5"><h3 className="m-0 font-head text-[18px] font-semibold text-text">Точки и команда</h3><div className="mt-4 space-y-3">{analytics.stores?.slice(0, 6).map((store) => <div key={store.store_id} className="border-b border-line2 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-semibold text-text">{store.name}</span><span className="font-bold tabular-nums text-text">{store.team}</span></div><div className="mt-1 text-[10px] text-muted">Обучение: {store.learning_compliant}/{store.team} · отсутствуют: {store.on_leave}</div></div>)}</div></PlatformCard></aside></div>;
}

function People({ employees, stores, search, onSearch, onSelect }) {
  return <div><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Сотрудники</h3><p className="mb-0 mt-1 text-[11px] text-muted">Активные аккаунты сотрудников и менеджеров</p></div><div className="w-full sm:w-80"><PlatformField label="Поиск" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="ФИО, телефон или почта" /></div></div>{employees.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => <button key={employee.id} type="button" onClick={() => onSelect(employee)} className="cursor-pointer rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-colors hover:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"><div className="flex items-center gap-3"><span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand font-head text-[13px] font-bold text-on-brand">{employee.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-text">{employee.full_name}</span><span className="mt-1 block truncate text-[10px] text-muted">{stores.find((store) => store.id === employee.store_id)?.name || 'Точка не указана'}</span></span><Icon name="chevronRight" size={18} className="text-faint" /></div><div className="mt-4 flex items-center justify-between gap-3"><StatusPill tone={employee.on_leave ? 'amber' : 'green'}>{employee.on_leave ? 'В отпуске' : 'Активен'}</StatusPill><span className="text-[10px] font-semibold text-muted">Обучение {employee.learning.compliance_percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-green" style={{ width: `${employee.learning.compliance_percent}%` }} /></div></button>)}</div> : <EmptyPlatformState icon="users" title="Сотрудники не найдены" subtitle="Измените поисковый запрос или фильтр торговой точки." />}</div>;
}

function EmployeeDetails({ employee }) {
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-surface2 p-4"><div className="font-head text-[25px] font-semibold text-text">{employee.learning.completed_courses}</div><div className="mt-1 text-[10px] text-muted">курсов завершено</div></div><div className="rounded-2xl bg-surface2 p-4"><div className="font-head text-[25px] font-semibold text-text">{employee.learning.compliance_percent}%</div><div className="mt-1 text-[10px] text-muted">обязательных программ</div></div></div><div className="rounded-2xl border border-line p-4"><div className="text-[11px] font-bold text-text">Контакты</div><div className="mt-3 space-y-2 text-[12px] text-muted"><div>{employee.phone || 'Телефон не указан'}</div><div>{employee.email || 'Почта не указана'}</div></div></div><ProgressBar value={employee.learning.compliance_percent} label={`${employee.learning.required_completed} из ${employee.learning.required_total} обязательных курсов`} /><div className="flex items-center justify-between rounded-2xl bg-green-tint p-4"><span className="text-[12px] font-semibold text-text">Текущий статус</span><StatusPill tone={employee.on_leave ? 'amber' : 'green'}>{employee.on_leave ? 'Отсутствует' : 'Работает'}</StatusPill></div></div>;
}

function Learning({ analytics }) {
  return <div><div className="mb-4"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Обучение и допуски</h3><p className="mb-0 mt-1 text-[11px] text-muted">Фактическое прохождение программ сотрудниками</p></div><div className="grid gap-4 lg:grid-cols-3">{analytics.courses?.map((course) => <PlatformCard key={course.course_id} className="p-5"><div className="flex items-start justify-between gap-3"><IconTile icon={course.course_id === 'kitchen-safety' ? 'shieldCheck' : course.course_id === 'shift-lead' ? 'briefcase' : 'users'} tone={course.required ? 'orange' : 'green'} /><StatusPill tone={course.required ? 'orange' : 'neutral'}>{course.required ? 'Обязательный' : 'Развитие'}</StatusPill></div><h4 className="mb-0 mt-4 font-head text-[18px] font-semibold text-text">{COURSE_NAMES[course.course_id] || course.course_id}</h4><div className="mt-5"><ProgressBar value={course.percent} label={`${course.completed} из ${course.total} сотрудников`} tone={course.required ? 'orange' : 'green'} /></div></PlatformCard>)}</div></div>;
}
