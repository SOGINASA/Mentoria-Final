import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import {
  DetailRow,
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  ProgressBar,
  SectionHeading,
  StatusPill,
} from '../components/PlatformUi';

const rows = [
  { key: 'base_pay', meta: '128 ч × ставка', amount: '143 200 ₸', tone: 'green', icon: 'clock' },
  { key: 'evening_pay', meta: '16 подтверждённых часов', amount: '+9 600 ₸', tone: 'orange', icon: 'moon' },
  { key: 'bonus_pay', meta: 'Качество и выполнение плана', amount: '+8 900 ₸', tone: 'amber', icon: 'checkCircle' },
  { key: 'waiting_pay', meta: '16 часов в табеле', amount: '+24 700 ₸', tone: 'neutral', icon: 'history' },
];

export default function PlatformIncomePage() {
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  const [selectedRow, setSelectedRow] = useState(null);

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.income} title={p.income_title} subtitle={p.income_sub} />

      <PlatformCard className="relative mt-6 overflow-hidden border-0 bg-green p-5 text-white shadow-card sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative z-[1] grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[12px] font-bold uppercase tracking-[.12em] text-white/70">{p.month_forecast}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">{p.preliminary}</span>
            </div>
            <div className="mt-3 font-head text-[44px] font-semibold leading-none tabular-nums sm:text-[56px]">186 400 ₸</div>
            <p className="mb-0 mt-3 max-w-xl text-[12px] leading-relaxed text-white/70 sm:text-[13px]">{p.income_note}</p>
          </div>
          <div className="rounded-[20px] bg-white/10 p-4">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span className="text-white/75">{p.earned}</span>
              <span className="tabular-nums">161 700 ₸</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/15">
              <div className="h-full w-[87%] rounded-full bg-orange" />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-white/65">
              <span>{p.planned}</span>
              <span className="tabular-nums">24 700 ₸</span>
            </div>
          </div>
        </div>
      </PlatformCard>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: 'clock', tone: 'green', label: p.hours, value: '144 ч', sub: p.hours_confirmed },
          { icon: 'wallet', tone: 'orange', label: p.earned, value: '161 700 ₸', sub: p.preliminary },
          { icon: 'plus', tone: 'amber', label: p.additions, value: p.additions_value, sub: '2 начисления' },
          { icon: 'history', tone: 'neutral', label: p.waiting_pay, value: '24 700 ₸', sub: '16 часов' },
        ].map((item) => (
          <PlatformCard key={item.label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <IconTile icon={item.icon} tone={item.tone} size="sm" />
              <StatusPill tone={item.tone === 'neutral' ? 'neutral' : item.tone}>{item.sub}</StatusPill>
            </div>
            <div className="mt-5 font-head text-[22px] font-semibold tabular-nums text-text sm:text-[26px]">{item.value}</div>
            <div className="mt-1 text-[11px] font-medium text-muted sm:text-[12px]">{item.label}</div>
          </PlatformCard>
        ))}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section>
          <SectionHeading title={p.calculation} />
          <PlatformCard className="overflow-hidden">
            {rows.map((row, index) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setSelectedRow(row)}
                className={`flex min-h-[82px] w-full cursor-pointer items-center gap-3.5 bg-transparent p-4 text-left transition-[background-color,transform] hover:bg-surface2 active:scale-[.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green sm:px-5 ${index ? 'border-t border-line2' : ''}`}
              >
                <IconTile icon={row.icon} tone={row.tone} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text sm:text-[14px]">{p[row.key]}</span>
                  <span className="mt-1 block text-[11px] text-muted sm:text-[12px]">{row.meta}</span>
                </span>
                <span className="font-head text-[16px] font-semibold tabular-nums text-text sm:text-[18px]">{row.amount}</span>
                <Icon name="chevronRight" size={16} className="hidden text-faint sm:block" />
              </button>
            ))}
          </PlatformCard>
        </section>

        <aside className="space-y-4">
          <section>
            <SectionHeading title={p.hours} />
            <PlatformCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-head text-[28px] font-semibold tabular-nums text-text">128 / 176 ч</div>
                  <div className="mt-1 text-[11px] text-muted">{p.hours_confirmed}</div>
                </div>
                <IconTile icon="pieChart" tone="green" />
              </div>
              <div className="mt-6 space-y-4">
                <ProgressBar value={73} label="Подтверждено" />
                <ProgressBar value={9} label="Ожидает проверки" tone="orange" />
              </div>
            </PlatformCard>
          </section>

          <PlatformCard className="p-5">
            <div className="flex items-start gap-3">
              <IconTile icon="clipboard" tone="neutral" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-text">{p.payslip}</div>
                <p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted">{p.payslip_sub}</p>
              </div>
            </div>
            <PlatformButton variant="secondary" className="mt-4 w-full" icon="helpCircle" onClick={() => navigate('/app/support')}>{p.ask_income}</PlatformButton>
          </PlatformCard>
        </aside>
      </div>

      <PlatformModal open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} title={selectedRow ? p[selectedRow.key] : ''} subtitle="Детализация предварительного расчёта" footer={<><PlatformButton variant="secondary" onClick={() => setSelectedRow(null)}>Закрыть</PlatformButton><PlatformButton icon="helpCircle" onClick={() => navigate('/app/support')}>{p.ask_income}</PlatformButton></>}>
        <div className="rounded-2xl bg-green-tint p-5">
          <div className="text-[11px] font-bold uppercase tracking-[.1em] text-green">Сумма начисления</div>
          <div className="mt-2 font-head text-[34px] font-semibold tabular-nums text-green">{selectedRow?.amount}</div>
        </div>
        <div className="mt-4">
          <DetailRow icon="calendar" label="Расчётный период" value="1–31 августа" />
          <DetailRow icon="clock" label="Основание" value={selectedRow?.meta} />
          <DetailRow icon="checkCircle" label="Статус" value={selectedRow?.key === 'waiting_pay' ? 'Ожидает проверки' : 'Подтверждено'} />
          <DetailRow icon="info" label="Обновлено" value="Сегодня, 08:30" />
        </div>
        <div className="mt-4 rounded-2xl bg-surface2 p-4 text-[12px] leading-relaxed text-muted">Финальная сумма фиксируется после закрытия табеля. Если часы указаны неверно, создайте обращение до конца расчётного периода.</div>
      </PlatformModal>
    </div>
  );
}
