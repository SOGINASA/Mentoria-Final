import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import {
  DetailRow,
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  PlatformField,
  SectionHeading,
  StatusPill,
} from '../components/PlatformUi';

const baseDate = new Date(2026, 7, 10);
const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function PlatformShiftsPage() {
  const { p } = usePlatformCopy();
  const user = useAuthStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const [view, setView] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(dayKey(addDays(baseDate, 1)));
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');

  const period = useMemo(() => {
    if (view === 'week') {
      const start = addDays(baseDate, periodOffset * 7);
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        const weekday = (date.getDay() + 6) % 7;
        return { date, weekday: weekdayNames[weekday], state: [0, 2, 3, 5].includes(index) ? 'shift' : 'off' };
      });
      return {
        days,
        label: `${start.getDate()}–${days[6].date.getDate()} ${monthNames[days[6].date.getMonth()]}`,
        year: days[6].date.getFullYear(),
      };
    }

    const monthDate = new Date(2026, 7 + periodOffset, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const firstWeekday = (monthDate.getDay() + 6) % 7;
    const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
      if (index < firstWeekday) return null;
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), index - firstWeekday + 1);
      const weekday = (date.getDay() + 6) % 7;
      return { date, weekday: weekdayNames[weekday], state: weekday < 5 && date.getDate() % 4 !== 0 ? 'shift' : 'off' };
    });
    return { days, label: monthNames[monthDate.getMonth()].replace(/^./, (letter) => letter.toUpperCase()), year: monthDate.getFullYear() };
  }, [periodOffset, view]);

  const upcoming = [
    { id: 1, date: 'Сегодня, 11 августа', time: '09:00–18:00', role: p.role_value, status: p.published, tone: 'green' },
    { id: 2, date: 'Среда, 12 августа', time: '12:00–21:00', role: p.role_value, status: p.published, tone: 'green' },
    { id: 3, date: 'Четверг, 13 августа', time: '09:00–18:00', role: p.role_value, status: p.published, tone: 'green' },
    { id: 4, date: 'Суббота, 15 августа', time: '10:00–19:00', role: p.role_value, status: p.published, tone: 'green' },
  ];

  function changeView(nextView) {
    setView(nextView);
    setPeriodOffset(0);
  }

  function requestSwap(shift) {
    setReason('');
    setModal({ type: 'swap', shift });
  }

  function confirmSwap() {
    setModal(null);
    showToast(p.swap_requested);
  }

  function confirmOpenShift() {
    setModal(null);
    showToast(p.shift_requested);
  }

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow={p.shifts}
        title={p.schedule_title}
        subtitle={p.schedule_sub}
        action={
          <div className="inline-flex rounded-2xl border border-line bg-surface p-1 shadow-card-sm" role="group" aria-label={p.schedule_title}>
            {[["week", p.week], ["month", p.month]].map(([value, label]) => (
              <button key={value} type="button" onClick={() => changeView(value)} aria-pressed={view === value} className={`min-h-10 cursor-pointer rounded-xl px-4 text-[12px] font-bold transition-[color,background-color,transform] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${view === value ? 'bg-green text-white' : 'text-muted hover:bg-surface2'}`}>{label}</button>
            ))}
          </div>
        }
      />

      <PlatformCard className="mt-6 overflow-hidden p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1 pb-4">
          <button type="button" onClick={() => setPeriodOffset((value) => value - 1)} className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-line text-text transition-colors hover:bg-surface2 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label="Предыдущий период"><Icon name="chevronLeft" size={19} /></button>
          <button type="button" onClick={() => setPeriodOffset(0)} className="min-h-11 cursor-pointer rounded-2xl px-4 text-center transition-colors hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label="Вернуться к текущему периоду">
            <span className="block font-head text-[18px] font-semibold text-text">{period.label}</span>
            <span className="mt-0.5 block text-[11px] text-muted">{period.year}{periodOffset === 0 ? ' • текущий период' : ''}</span>
          </button>
          <button type="button" onClick={() => setPeriodOffset((value) => value + 1)} className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-line text-text transition-colors hover:bg-surface2 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label="Следующий период"><Icon name="chevronRight" size={19} /></button>
        </div>

        {view === 'month' && <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-faint">{weekdayNames.map((name) => <span key={name} className="py-2">{name}</span>)}</div>}
        <div className={`grid grid-cols-7 ${view === 'week' ? 'gap-1.5 sm:gap-2' : 'gap-1 sm:gap-2'}`}>
          {period.days.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />;
            const selected = selectedDay === dayKey(day.date);
            return (
              <button key={dayKey(day.date)} type="button" onClick={() => { setSelectedDay(dayKey(day.date)); if (day.state === 'shift' && view === 'month') setModal({ type: 'day', day }); }} aria-pressed={selected} className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border px-1 transition-[color,background-color,border-color,transform] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${view === 'week' ? 'min-h-[82px] sm:min-h-[98px]' : 'min-h-[52px] sm:min-h-[64px]'} ${selected ? 'border-green bg-green text-white' : 'border-line bg-surface hover:bg-surface2'}`}>
                {view === 'week' && <span className={`text-[10px] font-bold uppercase ${selected ? 'text-white/70' : 'text-muted'}`}>{day.weekday}</span>}
                <span className={`${view === 'week' ? 'mt-1 text-[19px] sm:text-[23px]' : 'text-[14px] sm:text-[16px]'} font-head font-semibold tabular-nums`}>{day.date.getDate()}</span>
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : day.state === 'shift' ? 'bg-green' : 'bg-line'}`} />
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] font-medium text-muted">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green" />{p.regular_shift}</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-line" />{p.day_off}</span>
        </div>
      </PlatformCard>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(310px,.7fr)]">
        <section>
          <SectionHeading title={p.upcoming} />
          <div className="space-y-3">
            {upcoming.map((shift, index) => (
              <PlatformCard key={shift.id} className={`p-4 transition-colors sm:p-5 ${index === 0 ? 'border-green' : ''}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => setModal({ type: 'details', shift })} className="flex cursor-pointer items-center gap-3.5 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green sm:w-[210px]">
                    <IconTile icon="calendar" tone={index === 0 ? 'green' : 'neutral'} />
                    <span><span className="block text-[13px] font-bold text-text">{shift.date}</span><span className="mt-1 block text-[11px] text-muted">{user?.store?.name || 'Bahandi • Абая 21'}</span></span>
                  </button>
                  <button type="button" onClick={() => setModal({ type: 'details', shift })} className="min-w-0 flex-1 cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green sm:border-l sm:border-line sm:pl-5">
                    <span className="block font-head text-[22px] font-semibold tabular-nums text-text">{shift.time}</span><span className="mt-1 block text-[12px] text-muted">{shift.role}</span>
                  </button>
                  <div className="flex items-center justify-between gap-3 sm:justify-end"><StatusPill tone={shift.tone}>{shift.status}</StatusPill><button type="button" onClick={() => requestSwap(shift)} className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-line text-muted transition-colors hover:border-orange hover:bg-orange-tint hover:text-orange active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label={p.swap_shift}><Icon name="arrowSwap" size={19} /></button></div>
                </div>
              </PlatformCard>
            ))}
          </div>
        </section>

        <aside>
          <SectionHeading title={p.open_shifts} />
          <PlatformCard className="overflow-hidden">
            <div className="bg-orange p-5 text-white"><div className="text-[11px] font-bold uppercase tracking-[.12em] text-white/70">Пятница, 14 августа</div><div className="mt-2 font-head text-[29px] font-semibold tabular-nums">17:00–23:00</div><div className="mt-2 flex items-center gap-2 text-[12px] text-white/80"><Icon name="pin" size={16} />Bahandi • Достык</div></div>
            <div className="p-5"><div className="flex items-center gap-3"><IconTile icon="users" tone="orange" size="sm" /><div><div className="text-[13px] font-semibold text-text">Нужен 1 сотрудник кухни</div><div className="mt-1 text-[11px] text-muted">6 часов • вечерняя смена</div></div></div><PlatformButton className="mt-5 w-full" icon="plus" onClick={() => setModal({ type: 'openShift' })}>{p.request_shift}</PlatformButton></div>
          </PlatformCard>
          <PlatformCard className="mt-4 p-5"><div className="flex items-start gap-3"><IconTile icon="helpCircle" tone="green" size="sm" /><div><div className="text-[13px] font-bold text-text">Нужен другой график?</div><p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted">Создайте запрос менеджеру, если не можете выйти или хотите изменить время.</p></div></div><PlatformButton variant="secondary" className="mt-4 w-full" onClick={() => requestSwap(upcoming[0])}>{p.swap_shift}</PlatformButton></PlatformCard>
        </aside>
      </div>

      <PlatformModal open={modal?.type === 'details' || modal?.type === 'day'} onClose={() => setModal(null)} title="Детали смены" subtitle={modal?.shift?.date || 'Выбранный день'} footer={<><PlatformButton variant="secondary" onClick={() => setModal(null)}>Закрыть</PlatformButton><PlatformButton icon="arrowSwap" onClick={() => requestSwap(modal?.shift || upcoming[0])}>{p.swap_shift}</PlatformButton></>}>
        <div className="rounded-2xl bg-green-tint p-4"><div className="font-head text-[27px] font-semibold tabular-nums text-green">{modal?.shift?.time || '09:00–18:00'}</div><div className="mt-1 text-[12px] text-green">Смена опубликована и подтверждена</div></div>
        <div className="mt-4"><DetailRow icon="pin" label={p.store} value={user?.store?.name || 'Bahandi • Абая 21'} /><DetailRow icon="briefcase" label={p.role} value={p.role_value} /><DetailRow icon="coffee" label="Перерыв" value="45 минут" /></div>
      </PlatformModal>

      <PlatformModal open={modal?.type === 'swap'} onClose={() => setModal(null)} title="Запросить изменение смены" subtitle={`${modal?.shift?.date || ''} • ${modal?.shift?.time || ''}`} footer={<><PlatformButton variant="secondary" onClick={() => setModal(null)}>Отмена</PlatformButton><PlatformButton icon="send" onClick={confirmSwap}>Отправить менеджеру</PlatformButton></>}>
        <PlatformField as="textarea" label="Причина или комментарий" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Например: могу выйти после 12:00 или обменяться с коллегой…" hint="Менеджер увидит запрос и предложит доступные варианты." />
      </PlatformModal>

      <PlatformModal open={modal?.type === 'openShift'} onClose={() => setModal(null)} title="Подтвердить запрос" subtitle="Пятница, 14 августа • 17:00–23:00" footer={<><PlatformButton variant="secondary" onClick={() => setModal(null)}>Отмена</PlatformButton><PlatformButton icon="check" onClick={confirmOpenShift}>Запросить смену</PlatformButton></>}>
        <div className="rounded-2xl bg-orange-tint p-4 text-[13px] leading-relaxed text-muted">После отправки менеджер проверит график. Смена появится в календаре только после подтверждения.</div>
        <div className="mt-4"><DetailRow icon="pin" label={p.store} value="Bahandi • Достык" /><DetailRow icon="clock" label="Продолжительность" value="6 часов" /><DetailRow icon="wallet" label="Ориентировочный доход" value="8 400 ₸" /></div>
      </PlatformModal>
    </div>
  );
}
