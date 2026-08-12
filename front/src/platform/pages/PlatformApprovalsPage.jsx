import { useCallback, useEffect, useMemo, useState } from 'react';
import * as managerApi from '../../api/manager.api';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
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

const QUEUE_TYPES = {
  shift_requests: { label: 'Смены', singular: 'Запрос на смену', icon: 'calendar', tone: 'green' },
  timecards: { label: 'Табели', singular: 'Табель', icon: 'clock', tone: 'orange' },
  time_corrections: { label: 'Корректировки', singular: 'Корректировка времени', icon: 'history', tone: 'amber' },
  tasks: { label: 'Задачи', singular: 'Проверка задачи', icon: 'clipboard', tone: 'green' },
  document_requests: { label: 'Документы', singular: 'Запрос документа', icon: 'fileText', tone: 'orange' },
  leave_requests: { label: 'Отпуска', singular: 'Заявка на отсутствие', icon: 'calendar', tone: 'amber' },
};

const EMPTY_QUEUE = Object.keys(QUEUE_TYPES).reduce((result, key) => ({ ...result, [key]: [] }), {});

function hasPermission(permissions, permission) {
  return permissions.includes('*') || permissions.includes(permission);
}

function requestId(type, item) {
  return type === 'document_requests' || type === 'leave_requests' ? item.request_id : item.id;
}

function employeeId(type, item) {
  if (type === 'document_requests') return item.user_id;
  if (type === 'leave_requests' || type === 'shift_requests' || type === 'time_corrections') return item.requester_id;
  return item.assignee_id || item.user_id;
}

function itemTitle(type, item) {
  if (type === 'tasks') return item.title;
  if (type === 'document_requests') return item.title;
  if (type === 'leave_requests') return `${item.days} дн. · ${formatDay(item.starts_on)} — ${formatDay(item.ends_on)}`;
  if (type === 'timecards') return `${formatMinutes(item.worked_minutes)} · ${formatDay(item.clock_in_at)}`;
  if (type === 'time_corrections') return item.reason || `Табель #${item.timecard_id}`;
  const labels = { open_shift: 'Запрос на открытую смену', release: 'Освобождение смены', swap: 'Обмен сменами' };
  return labels[item.request_type] || `Смена #${item.shift_id}`;
}

function itemMeta(type, item) {
  const employee = employeeId(type, item);
  const parts = [employee ? `Сотрудник #${employee}` : null];
  if (item.store_id) parts.push(`Точка #${item.store_id}`);
  if (item.reference) parts.push(item.reference);
  if (item.created_at) parts.push(formatDateTime(item.created_at));
  return parts.filter(Boolean).join(' · ');
}

function formatMinutes(minutes = 0) {
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function formatDay(value) {
  if (!value) return 'дата не указана';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

async function loadQueue(permissions) {
  if (hasPermission(permissions, 'manager.queue')) {
    const data = await managerApi.getTodayQueue();
    return Object.keys(QUEUE_TYPES).reduce((result, key) => ({ ...result, [key]: data[key] || [] }), {});
  }

  const queue = { ...EMPTY_QUEUE };
  if (hasPermission(permissions, 'employee_services.manage')) {
    const [documents, leave] = await Promise.all([
      managerApi.listDocumentRequests(),
      managerApi.listLeaveRequests(),
    ]);
    queue.document_requests = documents.requests || [];
    queue.leave_requests = leave.requests || [];
  }
  return queue;
}

async function submitDecision(type, item, action, reason, fileUrl) {
  const common = { version: item.version, reason: reason.trim() || undefined };
  const id = requestId(type, item);
  if (type === 'shift_requests') return managerApi.decideShiftRequest(id, { ...common, decision: action });
  if (type === 'timecards') return managerApi.decideTimecard(id, { ...common, decision: action });
  if (type === 'time_corrections') return managerApi.decideTimeCorrection(id, { ...common, decision: action });
  if (type === 'tasks') return managerApi.reviewTask(id, { ...common, decision: action });
  if (type === 'leave_requests') return managerApi.decideLeaveRequest(id, { ...common, decision: action });
  return managerApi.decideDocumentRequest(id, {
    ...common,
    decision: action === 'approved' ? 'ready' : 'rejected',
    file_url: action === 'approved' ? fileUrl.trim() : undefined,
  });
}

export default function PlatformApprovalsPage() {
  const hydrated = usePlatformStore((state) => state.hydrated);
  const permissions = usePlatformStore((state) => state.permissions);
  const showToast = useUiStore((state) => state.showToast);
  const [queue, setQueue] = useState(EMPTY_QUEUE);
  const [activeType, setActiveType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    if (!hydrated) return;
    setLoading(true);
    setError('');
    try {
      setQueue(await loadQueue(permissions));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить очередь согласований');
    } finally {
      setLoading(false);
    }
  }, [hydrated, permissions]);

  useEffect(() => {
    reload();
  }, [reload]);

  const groups = useMemo(() => Object.entries(queue).filter(([, items]) => items.length), [queue]);
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
  const visibleGroups = activeType === 'all' ? groups : groups.filter(([type]) => type === activeType);

  function openDecision(type, item, action) {
    setDecision({ type, item, action });
    setReason('');
    setFileUrl('');
    setFormError('');
  }

  function closeDecision() {
    if (submitting) return;
    setDecision(null);
  }

  async function confirmDecision(event) {
    event.preventDefault();
    if (decision.action === 'rejected' && !reason.trim()) {
      setFormError('Укажите причину, чтобы сотрудник понимал, что исправить');
      return;
    }
    if (decision.type === 'document_requests' && decision.action === 'approved' && !fileUrl.trim()) {
      setFormError('Добавьте защищённую ссылку на готовый документ');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await submitDecision(decision.type, decision.item, decision.action, reason, fileUrl);
      setQueue((current) => ({
        ...current,
        [decision.type]: current[decision.type].filter((item) => requestId(decision.type, item) !== requestId(decision.type, decision.item)),
      }));
      showToast(decision.action === 'approved' ? 'Решение подтверждено' : 'Заявка возвращена сотруднику');
      setDecision(null);
    } catch (requestError) {
      setFormError(requestError.message || 'Не удалось сохранить решение');
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated || loading) {
    return <div className="grid min-h-[55dvh] place-items-center"><Spinner size={30} /></div>;
  }

  const allowed = hasPermission(permissions, 'manager.queue') || hasPermission(permissions, 'employee_services.manage');

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow="Рабочее пространство"
        title="Центр согласований"
        subtitle="Одна очередь решений по сменам, табелям, задачам и кадровым запросам. После решения сотрудник сразу увидит новый статус."
        action={allowed && <PlatformButton variant="secondary" icon="refresh" onClick={reload}>Обновить</PlatformButton>}
      />

      {!allowed ? (
        <div className="mt-6"><EmptyPlatformState icon="shield" title="Нет доступа к согласованиям" subtitle="Раздел доступен только ролям с правами принятия решений." /></div>
      ) : error ? (
        <PlatformCard className="mt-6 p-5" variant="orangeTint">
          <div role="alert" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-bold text-text">Очередь не загрузилась</div><div className="mt-1 text-[12px] text-muted">{error}</div></div>
            <PlatformButton variant="secondary" icon="refresh" onClick={reload}>Повторить</PlatformButton>
          </div>
        </PlatformCard>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(QUEUE_TYPES).map(([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(activeType === type ? 'all' : type)}
                aria-pressed={activeType === type}
                className={`min-h-[92px] rounded-[20px] border p-3 text-left shadow-card-sm transition-[background-color,border-color,transform] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${activeType === type ? 'border-green bg-green-tint' : 'border-line bg-surface hover:border-green'}`}
              >
                <div className="flex items-center justify-between gap-2"><Icon name={config.icon} size={19} className={activeType === type ? 'text-green' : 'text-muted'} /><span className="font-head text-[23px] font-semibold tabular-nums text-text">{queue[type].length}</span></div>
                <div className="mt-3 truncate text-[11px] font-bold text-muted">{config.label}</div>
              </button>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <h3 className="m-0 font-head text-[20px] font-semibold text-text">{activeType === 'all' ? 'Требуют решения' : QUEUE_TYPES[activeType].label}</h3>
            <StatusPill tone={total ? 'orange' : 'green'}>{total ? `${total} в очереди` : 'Всё обработано'}</StatusPill>
          </div>

          {!visibleGroups.length ? (
            <div className="mt-3"><EmptyPlatformState icon="checkCircle" title="Очередь разобрана" subtitle="Новых запросов, требующих вашего решения, сейчас нет." /></div>
          ) : (
            <div className="mt-3 space-y-6">
              {visibleGroups.map(([type, items]) => (
                <section key={type} aria-labelledby={`queue-${type}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <h4 id={`queue-${type}`} className="m-0 text-[13px] font-bold text-text">{QUEUE_TYPES[type].label}</h4>
                    <span className="text-[11px] font-semibold text-muted">{items.length}</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((item) => (
                      <PlatformCard key={requestId(type, item)} className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <IconTile icon={QUEUE_TYPES[type].icon} tone={QUEUE_TYPES[type].tone} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold uppercase tracking-[.08em] text-muted">{QUEUE_TYPES[type].singular}</div>
                            <h5 className="mb-0 mt-1.5 text-[14px] font-bold leading-snug text-text">{itemTitle(type, item)}</h5>
                            <p className="mb-0 mt-2 text-[11px] leading-relaxed text-muted">{itemMeta(type, item)}</p>
                            {item.comment && <p className="mb-0 mt-3 rounded-xl bg-surface2 p-3 text-[12px] leading-relaxed text-text">{item.comment}</p>}
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line2 pt-4">
                          <PlatformButton variant="secondary" icon="close" onClick={() => openDecision(type, item, 'rejected')}>Отклонить</PlatformButton>
                          <PlatformButton icon="check" onClick={() => openDecision(type, item, 'approved')}>Согласовать</PlatformButton>
                        </div>
                      </PlatformCard>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <PlatformModal
        open={Boolean(decision)}
        onClose={closeDecision}
        title={decision?.action === 'approved' ? 'Подтвердить решение' : 'Отклонить запрос'}
        subtitle={decision ? itemTitle(decision.type, decision.item) : ''}
        footer={<><PlatformButton variant="secondary" disabled={submitting} onClick={closeDecision}>Отмена</PlatformButton><PlatformButton variant={decision?.action === 'approved' ? 'primary' : 'danger'} loading={submitting} onClick={confirmDecision}>{decision?.action === 'approved' ? 'Подтвердить' : 'Отклонить'}</PlatformButton></>}
      >
        <form onSubmit={confirmDecision}>
          {decision?.type === 'document_requests' && decision.action === 'approved' && (
            <PlatformField label="Ссылка на готовый документ" type="url" value={fileUrl} onChange={(event) => { setFileUrl(event.target.value); setFormError(''); }} placeholder="https://..." hint="Используйте только защищённую корпоративную ссылку" />
          )}
          <div className={decision?.type === 'document_requests' && decision.action === 'approved' ? 'mt-4' : ''}>
            <PlatformField label={decision?.action === 'rejected' ? 'Причина отказа' : 'Комментарий к решению'} as="textarea" rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setFormError(''); }} placeholder={decision?.action === 'rejected' ? 'Что нужно исправить или уточнить' : 'Необязательно'} error={formError} />
          </div>
          <button type="submit" className="sr-only">Сохранить решение</button>
        </form>
      </PlatformModal>
    </div>
  );
}
