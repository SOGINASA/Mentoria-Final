import { useCallback, useEffect, useMemo, useState } from 'react';
import * as managerApi from '../../api/manager.api';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useUiStore } from '../../store/uiStore';
import PlatformModal from '../components/PlatformModal';
import {
  EmptyPlatformState,
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  PlatformField,
  StatusPill,
} from '../components/PlatformUi';

const TABS = [
  { id: 'overview', label: 'Обзор', icon: 'pieChart' },
  { id: 'shifts', label: 'Смены', icon: 'calendar' },
  { id: 'tasks', label: 'Задачи', icon: 'clipboard' },
  { id: 'team', label: 'Команда', icon: 'users' },
  { id: 'analytics', label: 'Аналитика', icon: 'pieChart' },
];

const EMPTY_SHIFT = {
  title: 'Рабочая смена', storeId: '', date: '', startsAt: '09:00', endsAt: '18:00',
  roleName: '', headcount: '1', breakMinutes: '30', notes: '', assigneeIds: [], publish: true,
};
const EMPTY_TASK = {
  title: '', description: '', storeId: '', assigneeId: '', dueAt: '', taskType: 'operation', steps: '',
};

function localDateTime(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return 'Без срока';
  const date = new Date(value);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function statusConfig(status) {
  const values = {
    draft: { label: 'Черновик', tone: 'neutral' },
    published: { label: 'Опубликована', tone: 'green' },
    active: { label: 'В работе', tone: 'orange' },
    in_progress: { label: 'В работе', tone: 'orange' },
    completed: { label: 'На проверке', tone: 'amber' },
    approved: { label: 'Принята', tone: 'green' },
    cancelled: { label: 'Отменена', tone: 'neutral' },
  };
  return values[status] || { label: status, tone: 'neutral' };
}

function userName(team, id) {
  return team.find((member) => member.id === id)?.full_name || (id ? `Сотрудник #${id}` : 'Вся команда');
}

export default function PlatformManagerPage() {
  const showToast = useUiStore((state) => state.showToast);
  const [workspace, setWorkspace] = useState({ stores: [], team: [], shifts: [], tasks: [] });
  const [storeFilter, setStoreFilter] = useState(() => new URLSearchParams(window.location.search).get('store_id') || 'all');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState('30');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWorkspace(await managerApi.getWorkspace());
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить данные точки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (tab !== 'analytics') return;
    let active = true;
    setAnalyticsLoading(true);
    managerApi.getAnalytics({ days: analyticsDays, storeId: storeFilter })
      .then((result) => { if (active) setAnalytics(result); })
      .catch((requestError) => { if (active) showToast(requestError.message || 'Не удалось загрузить аналитику'); })
      .finally(() => { if (active) setAnalyticsLoading(false); });
    return () => { active = false; };
  }, [analyticsDays, showToast, storeFilter, tab]);

  const defaultStoreId = workspace.stores[0]?.id ? String(workspace.stores[0].id) : '';
  const today = localDate();
  const visibleShifts = workspace.shifts.filter((shift) => storeFilter === 'all' || String(shift.store_id) === storeFilter);
  const visibleTasks = workspace.tasks.filter((task) => storeFilter === 'all' || String(task.store_id) === storeFilter);
  const visibleTeam = workspace.team.filter((member) => storeFilter === 'all' || String(member.store_id) === storeFilter);
  const activeTasks = visibleTasks.filter((task) => ['active', 'in_progress'].includes(task.status));
  const draftShifts = visibleShifts.filter((shift) => shift.status === 'draft');
  const upcomingShifts = visibleShifts.filter((shift) => new Date(shift.ends_at) >= new Date());
  const selectedMember = workspace.team.find((member) => member.id === selectedMemberId) || null;

  const filteredTeam = useMemo(() => {
    const storeId = ['shift', 'shiftEdit'].includes(modal) ? shiftForm.storeId : taskForm.storeId;
    return storeId ? workspace.team.filter((member) => String(member.store_id) === String(storeId)) : workspace.team;
  }, [modal, shiftForm.storeId, taskForm.storeId, workspace.team]);

  function openShiftForm() {
    setShiftForm({ ...EMPTY_SHIFT, storeId: defaultStoreId, date: today });
    setFormError('');
    setModal('shift');
  }

  function openTaskForm() {
    setTaskForm({ ...EMPTY_TASK, storeId: defaultStoreId });
    setFormError('');
    setModal('task');
  }

  function openEditTask(task) {
    setTaskForm({
      title: task.title || '', description: task.description || '', storeId: String(task.store_id),
      assigneeId: task.assignee_id ? String(task.assignee_id) : '', dueAt: toDateTimeInput(task.due_at),
      taskType: task.task_type || 'operation', steps: (task.steps || []).map((step) => step.title).join('\n'),
      id: task.id, version: task.version,
    });
    setFormError('');
    setModal('taskEdit');
  }

  function openEditShift(shift) {
    const startsAt = new Date(shift.starts_at);
    const endsAt = new Date(shift.ends_at);
    const assignedIds = (shift.assignments || []).filter((item) => item.status === 'confirmed').map((item) => item.user_id);
    setShiftForm({
      title: shift.title || 'Рабочая смена',
      storeId: String(shift.store_id),
      date: new Date(startsAt.getTime() - startsAt.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      startsAt: startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      endsAt: endsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      roleName: shift.role_name || '',
      headcount: String(shift.headcount),
      breakMinutes: String(shift.break_minutes || 0),
      notes: shift.notes || '',
      assigneeIds: assignedIds,
      existingAssigneeIds: assignedIds,
      publish: shift.status === 'published',
      id: shift.id,
      version: shift.version,
    });
    setFormError('');
    setModal('shiftEdit');
  }

  function updateShift(field, value) {
    setShiftForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function updateTask(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function toggleAssignee(id) {
    if (shiftForm.existingAssigneeIds?.includes(id)) return;
    setShiftForm((current) => ({
      ...current,
      assigneeIds: current.assigneeIds.includes(id)
        ? current.assigneeIds.filter((value) => value !== id)
        : [...current.assigneeIds, id],
    }));
  }

  async function saveShift(event) {
    event.preventDefault();
    if (!shiftForm.storeId || !shiftForm.date || !shiftForm.startsAt || !shiftForm.endsAt) {
      setFormError('Заполните точку, дату и время смены');
      return;
    }
    if (shiftForm.assigneeIds.length > Number(shiftForm.headcount)) {
      setFormError('Количество назначенных сотрудников превышает число мест');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        store_id: Number(shiftForm.storeId),
        title: shiftForm.title.trim() || 'Рабочая смена',
        starts_at: localDateTime(shiftForm.date, shiftForm.startsAt),
        ends_at: localDateTime(shiftForm.date, shiftForm.endsAt),
        role_name: shiftForm.roleName.trim() || null,
        headcount: Number(shiftForm.headcount),
        break_minutes: Number(shiftForm.breakMinutes),
        notes: shiftForm.notes.trim() || null,
      };
      const startsAt = new Date(payload.starts_at).getTime();
      const endsAt = new Date(payload.ends_at).getTime();
      if (endsAt <= startsAt) {
        setFormError('Окончание смены должно быть позже начала');
        setSubmitting(false);
        return;
      }
      const newAssigneeIds = shiftForm.assigneeIds.filter((id) => !shiftForm.existingAssigneeIds?.includes(id));
      const conflicts = newAssigneeIds.filter((userId) => workspace.shifts.some((shift) => (
        shift.id !== shiftForm.id
        && shift.status !== 'cancelled'
        && shift.assignments?.some((assignment) => assignment.user_id === userId && assignment.status === 'confirmed')
        && new Date(shift.starts_at).getTime() < endsAt
        && new Date(shift.ends_at).getTime() > startsAt
      )));
      if (conflicts.length) {
        setFormError(`Пересечение смен: ${conflicts.map((id) => userName(workspace.team, id)).join(', ')}`);
        setSubmitting(false);
        return;
      }
      const result = modal === 'shiftEdit'
        ? await managerApi.updateShift(shiftForm.id, { ...payload, version: shiftForm.version })
        : await managerApi.createShift(payload);
      for (const userId of newAssigneeIds) {
        await managerApi.assignShift(result.shift.id, userId);
      }
      if (modal === 'shift' && shiftForm.publish) await managerApi.publishShift(result.shift.id);
      await reload();
      setModal(null);
      showToast(modal === 'shiftEdit' ? 'Смена обновлена' : shiftForm.publish ? 'Смена создана и опубликована' : 'Черновик смены сохранён');
    } catch (requestError) {
      setFormError(requestError.message || 'Не удалось создать смену');
    } finally {
      setSubmitting(false);
    }
  }

  async function publishShift(shift) {
    try {
      await managerApi.publishShift(shift.id);
      await reload();
      showToast('Смена опубликована');
    } catch (requestError) {
      showToast(requestError.message || 'Не удалось опубликовать смену');
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim() || !taskForm.storeId) {
      setFormError('Укажите название задачи и торговую точку');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || (modal === 'taskEdit' ? '' : undefined),
        store_id: Number(taskForm.storeId),
        assignee_id: taskForm.assigneeId ? Number(taskForm.assigneeId) : (modal === 'taskEdit' ? null : undefined),
        due_at: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : (modal === 'taskEdit' ? null : undefined),
        task_type: taskForm.taskType,
        steps: taskForm.steps.split('\n').map((step) => step.trim()).filter(Boolean),
      };
      if (modal === 'taskEdit') await managerApi.updateTask(taskForm.id, { ...payload, version: taskForm.version });
      else await managerApi.createTask(payload);
      await reload();
      setModal(null);
      showToast(modal === 'taskEdit' ? 'Задача обновлена' : 'Задача создана');
    } catch (requestError) {
      setFormError(requestError.message || 'Не удалось создать задачу');
    } finally {
      setSubmitting(false);
    }
  }

  function requestAction(type, item, userId = null) {
    setActionTarget({ type, item, userId });
    setActionReason('');
    setFormError('');
  }

  async function confirmAction(event) {
    event.preventDefault();
    if (actionTarget?.type === 'cancelShift' && actionReason.trim().length < 3) {
      setFormError('Кратко укажите причину отмены');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      if (actionTarget.type === 'cancelShift') {
        await managerApi.cancelShift(actionTarget.item.id, { version: actionTarget.item.version, reason: actionReason.trim() });
        showToast('Смена отменена, сотрудники уведомлены');
      } else if (actionTarget.type === 'removeAssignment') {
        await managerApi.removeShiftAssignment(actionTarget.item.id, actionTarget.userId, { version: actionTarget.item.version, reason: actionReason.trim() || undefined });
        showToast('Сотрудник снят со смены');
      } else if (actionTarget.type === 'deleteTask') {
        await managerApi.deleteTask(actionTarget.item.id, { version: actionTarget.item.version, reason: actionReason.trim() || undefined });
        showToast('Задача удалена из работы');
      }
      await reload();
      setActionTarget(null);
    } catch (requestError) {
      setFormError(requestError.message || 'Не удалось выполнить действие');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="grid min-h-[55dvh] place-items-center"><Spinner size={30} /></div>;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow="Кабинет менеджера"
        title="Управление точкой"
        subtitle="Планируйте команду, публикуйте смены и назначайте задачи из одного рабочего пространства."
        action={<PlatformButton variant="secondary" icon="refresh" onClick={reload}>Обновить</PlatformButton>}
      />

      {workspace.stores.length > 1 && !error && (
        <div className="mt-5 max-w-sm">
          <PlatformField label="Показывать данные" as="select" value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
            <option value="all">Все доступные точки</option>
            {workspace.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </PlatformField>
        </div>
      )}

      {error ? (
        <PlatformCard className="mt-6 p-5" variant="orangeTint">
          <div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-bold text-text">Данные точки не загрузились</div><div className="mt-1 text-[12px] text-muted">{error}</div></div>
            <PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton>
          </div>
        </PlatformCard>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon="users" label="Команда" value={visibleTeam.length} meta="активных аккаунтов" />
            <Metric icon="calendar" label="Ближайшие смены" value={upcomingShifts.length} meta={`${draftShifts.length} в черновиках`} tone="orange" />
            <Metric icon="clipboard" label="Активные задачи" value={activeTasks.length} meta="требуют выполнения" />
            <Metric icon="store" label="Торговые точки" value={workspace.stores.length} meta="в вашей зоне доступа" tone="orange" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-[20px] border border-line bg-surface p-1.5 shadow-card-sm sm:grid-cols-5" role="tablist" aria-label="Управление точкой">
            {TABS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === item.id ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface2 hover:text-text'}`}>
                <Icon name={item.icon} size={18} /><span>{item.label}</span>
              </button>
            ))}
          </div>

          <div key={tab} className="platform-content-swap mt-6">
            {tab === 'overview' && <Overview workspace={workspace} upcomingShifts={upcomingShifts} activeTasks={activeTasks} onCreateShift={openShiftForm} onCreateTask={openTaskForm} onTab={setTab} />}
            {tab === 'shifts' && <ShiftList shifts={visibleShifts} stores={workspace.stores} team={workspace.team} onCreate={openShiftForm} onPublish={publishShift} onEdit={openEditShift} onCancel={(shift) => requestAction('cancelShift', shift)} onRemove={(shift, userId) => requestAction('removeAssignment', shift, userId)} />}
            {tab === 'tasks' && <TaskList tasks={visibleTasks} team={workspace.team} onCreate={openTaskForm} onEdit={openEditTask} onDelete={(task) => requestAction('deleteTask', task)} />}
            {tab === 'team' && <TeamList team={visibleTeam} stores={workspace.stores} shifts={upcomingShifts} tasks={activeTasks} onSelect={setSelectedMemberId} />}
            {tab === 'analytics' && <AnalyticsPanel data={analytics} loading={analyticsLoading} days={analyticsDays} onDays={setAnalyticsDays} />}
          </div>
        </>
      )}

      <PlatformModal open={['shift', 'shiftEdit'].includes(modal)} onClose={() => !submitting && setModal(null)} title={modal === 'shiftEdit' ? 'Изменить смену' : 'Новая смена'} subtitle={modal === 'shiftEdit' ? 'Назначенных сотрудников можно дополнить; снятие требует отдельного серверного действия' : 'Сначала сохранится смена, затем назначения и публикация'} size="lg" footer={<><PlatformButton variant="secondary" disabled={submitting} onClick={() => setModal(null)}>Отмена</PlatformButton><PlatformButton loading={submitting} icon="calendar" onClick={saveShift}>{modal === 'shiftEdit' ? 'Сохранить' : 'Создать смену'}</PlatformButton></>}>
        <form onSubmit={saveShift} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><PlatformField label="Название" value={shiftForm.title} onChange={(event) => updateShift('title', event.target.value)} /><PlatformField label="Торговая точка" as="select" disabled={modal === 'shiftEdit'} value={shiftForm.storeId} onChange={(event) => updateShift('storeId', event.target.value)}><option value="">Выберите точку</option>{workspace.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField></div>
          <div className="grid gap-4 sm:grid-cols-3"><PlatformField label="Дата" type="date" min={today} value={shiftForm.date} onChange={(event) => updateShift('date', event.target.value)} /><PlatformField label="Начало" type="time" value={shiftForm.startsAt} onChange={(event) => updateShift('startsAt', event.target.value)} /><PlatformField label="Окончание" type="time" value={shiftForm.endsAt} onChange={(event) => updateShift('endsAt', event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-3"><PlatformField label="Роль на смене" value={shiftForm.roleName} onChange={(event) => updateShift('roleName', event.target.value)} placeholder="Например, кассир" /><PlatformField label="Количество мест" type="number" min="1" max="100" value={shiftForm.headcount} onChange={(event) => updateShift('headcount', event.target.value)} /><PlatformField label="Перерыв, минут" type="number" min="0" value={shiftForm.breakMinutes} onChange={(event) => updateShift('breakMinutes', event.target.value)} /></div>
          <PlatformField label="Комментарий" as="textarea" rows={3} value={shiftForm.notes} onChange={(event) => updateShift('notes', event.target.value)} placeholder="Информация для команды" />
          <fieldset><legend className="mb-2 text-[12px] font-bold text-text">Назначить сотрудников</legend><div className="grid max-h-48 gap-2 overflow-y-auto rounded-2xl border border-line p-2 sm:grid-cols-2">{filteredTeam.map((member) => { const locked = shiftForm.existingAssigneeIds?.includes(member.id); return <label key={member.id} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 transition-colors ${locked ? 'cursor-default bg-green-tint text-green' : 'cursor-pointer hover:bg-surface2'} ${shiftForm.assigneeIds.includes(member.id) ? 'bg-green-tint text-green' : ''}`}><input type="checkbox" disabled={locked} checked={shiftForm.assigneeIds.includes(member.id)} onChange={() => toggleAssignee(member.id)} className="h-4 w-4 accent-green" /><span className="text-[12px] font-semibold">{member.full_name}{locked ? ' · назначен' : ''}</span></label>; })}{!filteredTeam.length && <span className="p-3 text-[12px] text-muted">В выбранной точке нет аккаунтов сотрудников.</span>}</div></fieldset>
          {modal === 'shift' && <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-surface2 px-4"><input type="checkbox" checked={shiftForm.publish} onChange={(event) => updateShift('publish', event.target.checked)} className="h-4 w-4 accent-green" /><span><span className="block text-[12px] font-bold text-text">Опубликовать сразу</span><span className="mt-0.5 block text-[11px] text-muted">Назначенные сотрудники получат уведомление</span></span></label>}
          {formError && <div role="alert" className="rounded-2xl bg-red-tint p-3 text-[12px] font-semibold text-red">{formError}</div>}
          <button type="submit" className="sr-only" aria-label="Отправить форму смены">Создать смену</button>
        </form>
      </PlatformModal>

      <PlatformModal open={Boolean(selectedMember)} onClose={() => setSelectedMemberId(null)} title={selectedMember?.full_name || 'Сотрудник'} subtitle={workspace.stores.find((store) => store.id === selectedMember?.store_id)?.name || 'Торговая точка'} footer={<PlatformButton onClick={() => setSelectedMemberId(null)}>Закрыть</PlatformButton>}>
        {selectedMember && <MemberDetails member={selectedMember} shifts={workspace.shifts} tasks={workspace.tasks} />}
      </PlatformModal>

      <PlatformModal open={['task', 'taskEdit'].includes(modal)} onClose={() => !submitting && setModal(null)} title={modal === 'taskEdit' ? 'Изменить задачу' : 'Новая задача'} subtitle="Назначьте сотрудника или оставьте задачу общей для точки" size="lg" footer={<><PlatformButton variant="secondary" disabled={submitting} onClick={() => setModal(null)}>Отмена</PlatformButton><PlatformButton loading={submitting} icon="clipboard" onClick={saveTask}>{modal === 'taskEdit' ? 'Сохранить' : 'Создать задачу'}</PlatformButton></>}>
        <form onSubmit={saveTask} className="space-y-4">
          <PlatformField label="Название задачи" value={taskForm.title} onChange={(event) => updateTask('title', event.target.value)} placeholder="Что нужно сделать" />
          <PlatformField label="Описание" as="textarea" rows={3} value={taskForm.description} onChange={(event) => updateTask('description', event.target.value)} placeholder="Контекст и критерий готовности" />
          <div className="grid gap-4 sm:grid-cols-2"><PlatformField label="Торговая точка" as="select" value={taskForm.storeId} onChange={(event) => { updateTask('storeId', event.target.value); updateTask('assigneeId', ''); }}><option value="">Выберите точку</option>{workspace.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField><PlatformField label="Исполнитель" as="select" value={taskForm.assigneeId} onChange={(event) => updateTask('assigneeId', event.target.value)}><option value="">Вся команда точки</option>{filteredTeam.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</PlatformField></div>
          <div className="grid gap-4 sm:grid-cols-2"><PlatformField label="Срок" type="datetime-local" value={taskForm.dueAt} onChange={(event) => updateTask('dueAt', event.target.value)} /><PlatformField label="Тип" as="select" value={taskForm.taskType} onChange={(event) => updateTask('taskType', event.target.value)}><option value="operation">Операционная задача</option><option value="checklist">Чек-лист</option><option value="learning">Обучение</option></PlatformField></div>
          <PlatformField label="Шаги чек-листа" as="textarea" rows={4} value={taskForm.steps} onChange={(event) => updateTask('steps', event.target.value)} placeholder={'Каждый пункт с новой строки\nПроверить температуру\nЗаполнить журнал'} hint="Если шаги не нужны, оставьте поле пустым" />
          {formError && <div role="alert" className="rounded-2xl bg-red-tint p-3 text-[12px] font-semibold text-red">{formError}</div>}
          <button type="submit" className="sr-only" aria-label="Отправить форму задачи">Создать задачу</button>
        </form>
      </PlatformModal>

      <PlatformModal open={Boolean(actionTarget)} onClose={() => !submitting && setActionTarget(null)} title={actionTarget?.type === 'cancelShift' ? 'Отменить смену?' : actionTarget?.type === 'removeAssignment' ? 'Снять сотрудника со смены?' : 'Удалить задачу?'} subtitle="Действие отразится у сотрудника и сохранится в журнале изменений" footer={<><PlatformButton variant="secondary" disabled={submitting} onClick={() => setActionTarget(null)}>Оставить как есть</PlatformButton><PlatformButton loading={submitting} icon={actionTarget?.type === 'deleteTask' ? 'trash' : 'check'} onClick={confirmAction}>{actionTarget?.type === 'cancelShift' ? 'Отменить смену' : actionTarget?.type === 'removeAssignment' ? 'Снять со смены' : 'Удалить задачу'}</PlatformButton></>}>
        <form onSubmit={confirmAction} className="space-y-4">
          <div className="rounded-2xl bg-orange-tint p-4 text-[12px] leading-relaxed text-text"><span className="font-bold">{actionTarget?.item?.title}</span>{actionTarget?.type === 'removeAssignment' && <span> · {userName(workspace.team, actionTarget.userId)}</span>}</div>
          <PlatformField as="textarea" rows={3} label={actionTarget?.type === 'cancelShift' ? 'Причина отмены' : 'Комментарий'} value={actionReason} onChange={(event) => { setActionReason(event.target.value); setFormError(''); }} placeholder="Кратко поясните решение" />
          {formError && <div role="alert" className="rounded-2xl bg-red-tint p-3 text-[12px] font-semibold text-red">{formError}</div>}
          <button type="submit" className="sr-only">Подтвердить</button>
        </form>
      </PlatformModal>
    </div>
  );
}

function Metric({ icon, label, value, meta, tone = 'green' }) {
  return <PlatformCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><IconTile icon={icon} tone={tone} size="sm" /><span className="font-head text-[29px] font-semibold tabular-nums text-text">{value}</span></div><div className="mt-4 text-[12px] font-bold text-text">{label}</div><div className="mt-1 text-[10px] text-muted sm:text-[11px]">{meta}</div></PlatformCard>;
}

function Overview({ workspace, upcomingShifts, activeTasks, onCreateShift, onCreateTask, onTab }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><section><div className="mb-3 flex items-center justify-between"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Ближайшие смены</h3><button type="button" onClick={() => onTab('shifts')} className="min-h-11 rounded-xl px-3 text-[12px] font-bold text-green hover:bg-green-tint">Все смены</button></div><ShiftList shifts={upcomingShifts.slice(0, 4)} stores={workspace.stores} team={workspace.team} compact /></section><aside className="space-y-4"><PlatformCard className="p-5"><h3 className="m-0 font-head text-[19px] font-semibold text-text">Быстрые действия</h3><div className="mt-4 grid gap-2"><PlatformButton icon="calendar" onClick={onCreateShift}>Создать смену</PlatformButton><PlatformButton variant="secondary" icon="clipboard" onClick={onCreateTask}>Поставить задачу</PlatformButton></div></PlatformCard><PlatformCard className="p-5"><div className="flex items-center justify-between"><h3 className="m-0 font-head text-[19px] font-semibold text-text">В работе</h3><StatusPill tone="orange">{activeTasks.length}</StatusPill></div><div className="mt-4 space-y-3">{activeTasks.slice(0, 3).map((task) => <div key={task.id} className="border-b border-line2 pb-3 last:border-0 last:pb-0"><div className="text-[12px] font-bold text-text">{task.title}</div><div className="mt-1 text-[10px] text-muted">{userName(workspace.team, task.assignee_id)} · {formatDateTime(task.due_at)}</div></div>)}{!activeTasks.length && <div className="text-[12px] text-muted">Активных задач нет.</div>}</div></PlatformCard></aside></div>;
}

function ShiftList({ shifts, stores, team, onCreate, onPublish, onEdit, onCancel, onRemove, compact = false }) {
  if (!shifts.length) return <EmptyPlatformState icon="calendar" title="Смен пока нет" subtitle="Создайте первую смену и назначьте сотрудников." />;
  return <div><div className="mb-3 flex items-center justify-between gap-3">{!compact && <h3 className="m-0 font-head text-[20px] font-semibold text-text">План смен</h3>}{onCreate && !compact && <PlatformButton icon="plus" onClick={onCreate}>Новая смена</PlatformButton>}</div><div className="grid gap-3">{shifts.map((shift) => { const status = statusConfig(shift.status); const assigned = shift.assignments?.filter((item) => item.status === 'confirmed') || []; const editable = shift.status !== 'cancelled'; return <PlatformCard key={shift.id} className="p-4 sm:p-5"><div className="flex items-start gap-3"><IconTile icon="calendar" tone={status.tone === 'neutral' ? 'neutral' : 'green'} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="m-0 text-[14px] font-bold text-text">{shift.title}</h4><StatusPill tone={status.tone}>{status.label}</StatusPill></div><div className="mt-2 text-[12px] font-semibold text-text">{formatDateTime(shift.starts_at)} — {new Date(shift.ends_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div><div className="mt-1 text-[11px] text-muted">{stores.find((store) => store.id === shift.store_id)?.name || `Точка #${shift.store_id}`} · {assigned.length}/{shift.headcount} назначено</div>{assigned.length > 0 && <div className="mt-3 grid gap-1.5 sm:grid-cols-2">{assigned.map((item) => onRemove && editable ? <button key={item.id} type="button" onClick={() => onRemove(shift, item.user_id)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-surface2 px-3 text-left text-[11px] font-semibold text-muted transition-colors hover:bg-red-tint hover:text-red"><span className="truncate">{item.user?.full_name || userName(team, item.user_id)}</span><Icon name="close" size={15} /></button> : <span key={item.id} className="rounded-full bg-surface2 px-2.5 py-1 text-[10px] font-semibold text-muted">{item.user?.full_name || userName(team, item.user_id)}</span>)}</div>}</div></div>{!compact && editable && <div className="mt-4 flex flex-col gap-2 border-t border-line2 pt-3 sm:flex-row sm:flex-wrap">{onEdit && <PlatformButton variant="secondary" icon="edit" onClick={() => onEdit(shift)}>Изменить</PlatformButton>}{shift.status === 'draft' && onPublish && <PlatformButton icon="send" onClick={() => onPublish(shift)}>Опубликовать</PlatformButton>}{onCancel && <PlatformButton variant="secondary" icon="close" onClick={() => onCancel(shift)}>Отменить смену</PlatformButton>}</div>}</PlatformCard>; })}</div></div>;
}

function TaskList({ tasks, team, onCreate, onEdit, onDelete }) {
  return <div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="m-0 font-head text-[20px] font-semibold text-text">Задачи точки</h3><PlatformButton icon="plus" onClick={onCreate}>Новая задача</PlatformButton></div>{tasks.length ? <div className="grid gap-3 lg:grid-cols-2">{tasks.map((task) => { const status = statusConfig(task.status); const editable = !['approved', 'completed', 'cancelled'].includes(task.status); return <PlatformCard key={task.id} className="p-4 sm:p-5"><div className="flex items-start gap-3"><IconTile icon="clipboard" tone={status.tone} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="m-0 text-[14px] font-bold text-text">{task.title}</h4><StatusPill tone={status.tone}>{status.label}</StatusPill></div><p className="mb-0 mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted">{task.description || 'Без дополнительного описания'}</p><div className="mt-3 text-[11px] font-semibold text-text">{userName(team, task.assignee_id)}</div><div className="mt-1 text-[10px] text-muted">Срок: {formatDateTime(task.due_at)} · {task.steps?.length || 0} шагов</div></div></div>{editable && <div className="mt-4 flex gap-2 border-t border-line2 pt-3"><PlatformButton variant="secondary" icon="edit" onClick={() => onEdit(task)}>Изменить</PlatformButton><PlatformButton variant="secondary" icon="trash" onClick={() => onDelete(task)}>Удалить</PlatformButton></div>}</PlatformCard>; })}</div> : <EmptyPlatformState title="Задач пока нет" subtitle="Создайте поручение сотруднику или общий чек-лист точки." />}</div>;
}

function AnalyticsPanel({ data, loading, days, onDays }) {
  if (loading && !data) return <div className="grid min-h-64 place-items-center"><Spinner size={28} /></div>;
  if (!data) return <EmptyPlatformState icon="pieChart" title="Аналитика недоступна" subtitle="Обновите страницу или попробуйте позднее." />;
  const summary = data.totals || {};
  const series = data.series || [];
  const taskStatuses = data.task_statuses || {};
  const caseStatuses = data.case_statuses || {};
  const maxMinutes = Math.max(...series.map((item) => item.worked_minutes || 0), 1);
  const completionRate = summary.tasks_created ? Math.round((summary.tasks_completed || 0) * 100 / summary.tasks_created) : 0;
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="m-0 font-head text-[20px] font-semibold text-text">Показатели точки</h3><p className="mb-0 mt-1 text-[11px] text-muted">Фактические данные за выбранный период</p></div><div className="w-full sm:w-48"><PlatformField aria-label="Период аналитики" as="select" value={days} onChange={(event) => onDays(event.target.value)}><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option><option value="90">Последние 90 дней</option></PlatformField></div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon="clock" label="Отработано" value={`${Math.round((summary.worked_minutes || 0) / 60)} ч`} meta={`из ${Math.round((summary.scheduled_minutes || 0) / 60)} ч по плану`} /><Metric icon="clipboard" label="Задачи" value={summary.tasks_completed || 0} meta={`${summary.tasks_overdue || 0} просрочено`} tone="orange" /><Metric icon="helpCircle" label="Обращения" value={summary.open_cases || 0} meta="открыто сейчас" /><Metric icon="trash" label="Списания" value={summary.writeoffs || 0} meta="за период" tone="orange" /></div><div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]"><PlatformCard className="min-w-0 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h4 className="m-0 text-[14px] font-bold text-text">Отработанное время</h4><div className="mt-1 text-[10px] text-muted">По дням, в часах</div></div>{loading && <Spinner size={18} />}</div><div className="mt-6 overflow-x-auto pb-1"><div className="flex h-48 items-end gap-1.5" style={{ minWidth: `${Math.max(560, series.length * 18)}px` }} role="img" aria-label="График отработанного времени по дням">{series.map((item) => <div key={item.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end"><div title={`${item.date}: ${Math.round((item.worked_minutes || 0) / 6) / 10} ч`} className="min-h-1 rounded-t-md bg-green transition-[height,background-color] hover:bg-orange" style={{ height: `${Math.max(3, (item.worked_minutes || 0) / maxMinutes * 100)}%` }} /><span className="mt-2 truncate text-center text-[9px] text-faint">{new Date(`${item.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span></div>)}</div></div></PlatformCard><PlatformCard className="p-5 sm:p-6"><h4 className="m-0 text-[14px] font-bold text-text">Операционная сводка</h4><div className="mt-4 grid grid-cols-2 gap-2"><SummaryCell value={summary.team || 0} label="сотрудников" /><SummaryCell value={summary.shifts || 0} label="смен проведено" /><SummaryCell value={`${completionRate}%`} label="задач выполнено" /><SummaryCell value={summary.tasks_created || 0} label="задач создано" /></div><h5 className="mb-2 mt-5 text-[11px] font-bold text-muted">Статусы задач</h5><StatusRow label="Активные" value={(taskStatuses.active || 0) + (taskStatuses.in_progress || 0)} /><StatusRow label="Выполненные" value={(taskStatuses.completed || 0) + (taskStatuses.approved || 0)} /><StatusRow label="Отменённые" value={taskStatuses.cancelled || 0} /><h5 className="mb-2 mt-5 text-[11px] font-bold text-muted">Обращения</h5><StatusRow label="Открытые" value={(caseStatuses.open || 0) + (caseStatuses.in_progress || 0)} /><StatusRow label="Закрытые" value={(caseStatuses.resolved || 0) + (caseStatuses.closed || 0)} /></PlatformCard></div></div>;
}

function SummaryCell({ value, label }) {
  return <div className="rounded-2xl bg-surface2 p-3"><div className="font-head text-[22px] font-semibold tabular-nums text-text">{value}</div><div className="mt-1 text-[10px] text-muted">{label}</div></div>;
}

function StatusRow({ label, value }) {
  return <div className="flex min-h-9 items-center justify-between border-b border-line2 text-[11px] last:border-0"><span className="text-muted">{label}</span><span className="font-bold tabular-nums text-text">{value}</span></div>;
}

function TeamList({ team, stores, shifts, tasks, onSelect }) {
  return <div><h3 className="mb-3 mt-0 font-head text-[20px] font-semibold text-text">Команда точки</h3>{team.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{team.map((member) => { const memberShifts = shifts.filter((shift) => shift.assignments?.some((assignment) => assignment.user_id === member.id && assignment.status === 'confirmed')).length; const memberTasks = tasks.filter((task) => task.assignee_id === member.id).length; return <PlatformCard key={member.id} as="button" type="button" onClick={() => onSelect(member.id)} className="cursor-pointer p-4 text-left hover:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"><div className="flex items-center gap-3"><span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand font-head text-[14px] font-bold text-on-brand">{member.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-text">{member.full_name}</div><div className="mt-1 truncate text-[10px] text-muted">{stores.find((store) => store.id === member.store_id)?.name || 'Точка не указана'}</div></div><Icon name="chevronRight" size={18} className="text-faint" /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-surface2 p-3"><div className="font-head text-[20px] font-semibold text-text">{memberShifts}</div><div className="mt-1 text-[10px] text-muted">ближайших смен</div></div><div className="rounded-xl bg-surface2 p-3"><div className="font-head text-[20px] font-semibold text-text">{memberTasks}</div><div className="mt-1 text-[10px] text-muted">активных задач</div></div></div></PlatformCard>; })}</div> : <EmptyPlatformState icon="users" title="Команда не найдена" subtitle="Активные аккаунты сотрудников появятся после привязки к торговой точке." />}</div>;
}

function MemberDetails({ member, shifts, tasks }) {
  const memberShifts = shifts.filter((shift) => shift.assignments?.some((assignment) => assignment.user_id === member.id && assignment.status === 'confirmed')).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const memberTasks = tasks.filter((task) => task.assignee_id === member.id);
  return <div className="space-y-5"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-surface2 p-4"><div className="font-head text-[26px] font-semibold text-text">{memberShifts.length}</div><div className="mt-1 text-[11px] text-muted">смен в плане</div></div><div className="rounded-2xl bg-surface2 p-4"><div className="font-head text-[26px] font-semibold text-text">{memberTasks.filter((task) => ['active', 'in_progress'].includes(task.status)).length}</div><div className="mt-1 text-[11px] text-muted">активных задач</div></div></div><section><h3 className="m-0 text-[13px] font-bold text-text">Ближайшие смены</h3><div className="mt-2 space-y-2">{memberShifts.filter((shift) => new Date(shift.ends_at) >= new Date()).slice(0, 5).map((shift) => <div key={shift.id} className="rounded-2xl border border-line p-3"><div className="text-[12px] font-bold text-text">{shift.title}</div><div className="mt-1 text-[11px] text-muted">{formatDateTime(shift.starts_at)}</div></div>)}{!memberShifts.some((shift) => new Date(shift.ends_at) >= new Date()) && <div className="rounded-2xl bg-surface2 p-3 text-[11px] text-muted">Ближайших смен нет.</div>}</div></section><section><h3 className="m-0 text-[13px] font-bold text-text">Задачи сотрудника</h3><div className="mt-2 space-y-2">{memberTasks.slice(0, 6).map((task) => { const status = statusConfig(task.status); return <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-line p-3"><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-text">{task.title}</div><div className="mt-1 text-[10px] text-muted">{formatDateTime(task.due_at)}</div></div><StatusPill tone={status.tone}>{status.label}</StatusPill></div>; })}{!memberTasks.length && <div className="rounded-2xl bg-surface2 p-3 text-[11px] text-muted">Назначенных задач нет.</div>}</div></section></div>;
}
