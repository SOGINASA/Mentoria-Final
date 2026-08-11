import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { LEAVE_TYPES } from '../platformData';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, PlatformCard, PlatformField, SectionHeading, StatusPill } from '../components/PlatformUi';

const INITIAL_FORM = { type: 'annual', startDate: '', endDate: '', comment: '' };
const STATUS = {
  pending: { label: 'На согласовании', tone: 'amber' },
  approved: { label: 'Согласовано', tone: 'green' },
  rejected: { label: 'Отклонено', tone: 'red' },
  cancelled: { label: 'Отменено', tone: 'neutral' },
};

function inclusiveDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end - start) / 86400000) + 1;
}

function formatDateRange(startDate, endDate) {
  const format = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format.format(new Date(`${startDate}T00:00:00`))} — ${format.format(new Date(`${endDate}T00:00:00`))}`;
}

function localInputDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function PlatformLeavePage() {
  const showToast = useUiStore((state) => state.showToast);
  const leaveRequests = usePlatformStore((state) => state.leaveRequests);
  const createLeaveRequest = usePlatformStore((state) => state.createLeaveRequest);
  const cancelLeaveRequest = usePlatformStore((state) => state.cancelLeaveRequest);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);
  const days = inclusiveDays(form.startDate, form.endDate);
  const today = localInputDate();
  const approvedDays = useMemo(() => leaveRequests.filter((request) => request.status === 'approved' && request.type === 'annual').reduce((sum, request) => sum + request.days, 0), [leaveRequests]);
  const annualAllowance = 24;
  const usedDays = 5;
  const availableDays = Math.max(0, annualAllowance - usedDays - approvedDays);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
  }

  function submitRequest(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.startDate) nextErrors.startDate = 'Выберите дату начала';
    if (!form.endDate) nextErrors.endDate = 'Выберите дату окончания';
    if (form.startDate && form.endDate && days <= 0) nextErrors.endDate = 'Дата окончания должна быть не раньше начала';
    if (form.type === 'annual' && days > availableDays) nextErrors.endDate = `Доступно только ${availableDays} дней отпуска`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(nextErrors.startDate ? 'leave-start-date' : 'leave-end-date')?.focus();
      return;
    }

    const selectedType = LEAVE_TYPES.find((item) => item.id === form.type);
    const request = createLeaveRequest({ ...form, typeLabel: selectedType.label, days });
    setForm(INITIAL_FORM);
    showToast(`Заявка ${request.id} отправлена`);
  }

  function confirmCancellation() {
    cancelLeaveRequest(cancelTarget.id);
    showToast(`Заявка ${cancelTarget.id} отменена`);
    setCancelTarget(null);
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow="HR-сервис" title="Отпуск и отсутствие" subtitle="Проверяйте баланс, отправляйте заявки и следите за согласованием без переписки." />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <PlatformCard variant="orangeTint" className="p-5">
          <div className="text-[11px] font-bold uppercase tracking-[.1em] text-orange">Доступно</div>
          <div className="mt-2 font-head text-[32px] font-semibold text-orange">{availableDays} дней</div>
          <div className="mt-1 text-[12px] text-muted">оплачиваемого отпуска</div>
        </PlatformCard>
        <PlatformCard className="p-5">
          <div className="text-[11px] font-bold uppercase tracking-[.1em] text-muted">Запланировано</div>
          <div className="mt-2 font-head text-[32px] font-semibold text-text">{approvedDays} дней</div>
          <div className="mt-1 text-[12px] text-muted">в согласованных заявках</div>
        </PlatformCard>
        <PlatformCard className="p-5">
          <div className="text-[11px] font-bold uppercase tracking-[.1em] text-muted">На согласовании</div>
          <div className="mt-2 font-head text-[32px] font-semibold text-text">{leaveRequests.filter((request) => request.status === 'pending').length}</div>
          <div className="mt-1 text-[12px] text-muted">активных заявок</div>
        </PlatformCard>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.72fr)]">
        <section>
          <SectionHeading title="История заявок" />
          <PlatformCard className="overflow-hidden">
            {leaveRequests.map((request) => {
              const status = STATUS[request.status] || STATUS.pending;
              return (
                <div key={request.id} className="border-b border-line2 p-4 last:border-b-0 sm:p-5">
                  <div className="flex items-start gap-3">
                    <IconTile icon="calendar" tone={status.tone === 'amber' ? 'amber' : status.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="m-0 text-[13px] font-bold text-text">{request.typeLabel}</h3>
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </div>
                      <div className="mt-2 text-[12px] font-semibold text-text">{formatDateRange(request.startDate, request.endDate)}</div>
                      <div className="mt-1 text-[11px] text-muted">{request.days} дн. • {request.id}</div>
                      {request.comment && <p className="mb-0 mt-3 rounded-xl bg-surface2 p-3 text-[11px] leading-relaxed text-muted">{request.comment}</p>}
                      {request.status === 'pending' && (
                        <button type="button" onClick={() => setCancelTarget(request)} className="mt-3 min-h-11 rounded-xl px-2 text-[12px] font-bold text-red transition-colors hover:bg-red-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red">Отменить заявку</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </PlatformCard>
        </section>

        <section>
          <SectionHeading title="Новая заявка" />
          <PlatformCard as="form" onSubmit={submitRequest} className="p-5 sm:p-6">
            <PlatformField label="Тип отсутствия" as="select" value={form.type} onChange={(event) => updateField('type', event.target.value)}>
              {LEAVE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </PlatformField>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PlatformField id="leave-start-date" label="Дата начала" type="date" min={today} value={form.startDate} error={errors.startDate} onChange={(event) => updateField('startDate', event.target.value)} />
              <PlatformField id="leave-end-date" label="Дата окончания" type="date" min={form.startDate || today} value={form.endDate} error={errors.endDate} onChange={(event) => updateField('endDate', event.target.value)} />
            </div>
            <div className="mt-4">
              <PlatformField label="Комментарий" as="textarea" rows={4} value={form.comment} onChange={(event) => updateField('comment', event.target.value)} placeholder="При необходимости добавьте пояснение" />
            </div>
            {days > 0 && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-green-tint p-3 text-[12px] font-semibold text-green"><Icon name="calendar" size={18} />Продолжительность: {days} дн.</div>}
            <PlatformButton type="submit" icon="send" className="mt-5 w-full">Отправить на согласование</PlatformButton>
            <p className="mb-0 mt-3 text-[11px] leading-relaxed text-muted">Менеджер смены и HR получат заявку. Изменение статуса появится здесь и в уведомлениях.</p>
          </PlatformCard>
        </section>
      </div>

      <PlatformModal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Отменить заявку?" subtitle={cancelTarget?.id} footer={<><PlatformButton variant="secondary" onClick={() => setCancelTarget(null)}>Оставить</PlatformButton><PlatformButton variant="danger" onClick={confirmCancellation}>Отменить заявку</PlatformButton></>}>
        <div className="rounded-2xl bg-red-tint p-4 text-[13px] leading-relaxed text-red">Заявка будет закрыта. Для других дат потребуется создать новую.</div>
      </PlatformModal>
    </div>
  );
}
