import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { taskProgress, usePlatformStore } from '../../store/platformStore';
import { usePlatformCopy } from '../platformCopy';
import { PLATFORM_ROUTES } from '../platformConfig';
import {
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  ProgressBar,
  SectionHeading,
  StatusPill,
} from '../components/PlatformUi';

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greeting_morning';
  if (hour < 18) return 'greeting_day';
  return 'greeting_evening';
}

function firstName(fullName = '') {
  return fullName.trim().split(/\s+/)[0] || '';
}

export default function PlatformHomePage() {
  const navigate = useNavigate();
  const { p, lang } = usePlatformCopy();
  const user = useAuthStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const shiftActive = usePlatformStore((state) => state.shiftActive);
  const setShiftActive = usePlatformStore((state) => state.setShiftActive);
  const tasks = usePlatformStore((state) => state.tasks);

  const date = new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  const priorityTasks = tasks.filter((task) => !task.done).slice(0, 3);

  const quickActions = [
    { title: p.open_schedule, icon: 'calendar', tone: 'green', to: PLATFORM_ROUTES.shifts },
    { title: p.swap_shift, icon: 'arrowSwap', tone: 'orange', to: PLATFORM_ROUTES.shifts },
    { title: p.writeoff, icon: 'camera', tone: 'amber', to: '/create' },
    { title: p.ask_help, icon: 'helpCircle', tone: 'green', to: PLATFORM_ROUTES.support },
  ];

  function toggleShift() {
    setShiftActive(!shiftActive);
    showToast(shiftActive ? p.end_shift : p.shift_started);
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow={date}
        title={`${p[greetingKey()]}, ${firstName(user?.full_name)}`}
        subtitle={p.home_sub}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <PlatformCard variant="brand" className="relative overflow-hidden p-5 shadow-card sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-20 h-48 w-48 rounded-full bg-orange/20" />
          <div className="relative z-[1]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[.12em] text-white/70">{p.shift_today}</div>
                <div className="mt-2 font-head text-[31px] font-semibold leading-none sm:text-[38px]">09:00–18:00</div>
              </div>
              <StatusPill tone={shiftActive ? 'orange' : 'green'}>
                {shiftActive ? p.shift_started : `${p.shift_in}: 32 мин`}
              </StatusPill>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Icon name="pin" size={20} /></span>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-white/65">{p.store}</div>
                  <div className="truncate text-[14px] font-semibold">{user?.store?.name || 'Bahandi • Абая 21'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Icon name="briefcase" size={20} /></span>
                <div>
                  <div className="text-[11px] font-medium text-white/65">{p.role}</div>
                  <div className="text-[14px] font-semibold">{p.role_value}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[12px] font-medium text-white/75">
                <Icon name="users" size={17} />
                <span>{p.team_today}</span>
              </div>
              <button
                type="button"
                onClick={toggleShift}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[14px] font-bold text-green shadow-card-sm transition-colors hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green"
              >
                <Icon name={shiftActive ? 'stop' : 'play'} size={18} />
                {shiftActive ? p.end_shift : p.start_shift}
              </button>
            </div>
          </div>
        </PlatformCard>

        <PlatformCard className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[.1em] text-muted">{p.forecast}</div>
              <div className="mt-2 font-head text-[31px] font-semibold tabular-nums text-text sm:text-[36px]">186 400 ₸</div>
            </div>
            <IconTile icon="wallet" tone="green" />
          </div>
          <div className="mt-1 text-[12px] text-muted">{p.preliminary}</div>
          <div className="mt-6">
            <ProgressBar value={72} label={p.confirmed_hours} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface2 px-3.5 py-3 text-[12px]">
            <span className="text-muted">128 / 176 ч</span>
            <button type="button" onClick={() => navigate(PLATFORM_ROUTES.income)} className="min-h-8 rounded-lg px-2 font-bold text-green hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
              {p.income} <span aria-hidden="true">→</span>
            </button>
          </div>
        </PlatformCard>
      </div>

      <section className="mt-7" aria-labelledby="quick-actions-title">
        <SectionHeading title={p.quick_actions} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={() => navigate(action.to)}
              className="group flex min-h-[112px] flex-col items-start justify-between rounded-[20px] border border-line bg-surface p-4 text-left shadow-card-sm transition-[border-color,background-color] hover:border-green hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              <IconTile icon={action.icon} tone={action.tone} size="sm" />
              <span className="mt-4 text-[13px] font-bold leading-snug text-text group-hover:text-green sm:text-[14px]">{action.title}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <section aria-labelledby="priority-title">
          <SectionHeading
            title={p.priority}
            action={<PlatformButton variant="soft" onClick={() => navigate(PLATFORM_ROUTES.tasks)}>{p.see_all}</PlatformButton>}
          />
          <PlatformCard className="overflow-hidden">
            {priorityTasks.map((task, index) => (
              <button
                key={task.id}
                type="button"
                onClick={() => navigate(PLATFORM_ROUTES.tasks)}
                className={`flex min-h-[78px] w-full items-center gap-3.5 bg-transparent p-4 text-left transition-colors hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green sm:px-5 ${index ? 'border-t border-line2' : ''}`}
              >
                <IconTile icon={task.icon} tone={task.tone} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-text">{task.title || p[task.titleKey]}</span>
                  <span className="mt-1 block text-[12px] text-muted">{task.subtitle || p[task.subKey]}</span>
                </span>
                <span className="hidden text-[11px] font-semibold tabular-nums text-faint sm:block">{taskProgress(task) != null ? `${taskProgress(task)}%` : task.due}</span>
                <Icon name="chevronRight" size={17} className="text-faint" />
              </button>
            ))}
          </PlatformCard>
        </section>

        <section aria-labelledby="news-title">
          <SectionHeading title={p.news} />
          <PlatformCard className="h-[238px] overflow-hidden p-5">
            <div className="flex items-center justify-between gap-3">
              <IconTile icon="bell" tone="orange" />
              <StatusPill tone="orange">NEW</StatusPill>
            </div>
            <h4 className="mb-2 mt-5 font-head text-[19px] font-semibold leading-snug text-text">{p.news_title}</h4>
            <p className="m-0 text-[13px] leading-relaxed text-muted">{p.news_sub}</p>
            <button type="button" onClick={() => navigate(PLATFORM_ROUTES.news)} className="mt-4 min-h-9 rounded-xl px-2 text-[12px] font-bold text-green hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
              {p.see_all} <span aria-hidden="true">→</span>
            </button>
          </PlatformCard>
        </section>
      </div>
    </div>
  );
}
