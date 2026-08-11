import { usePlatformStore } from '../../store/platformStore';
import { usePlatformCopy } from '../platformCopy';
import { IconTile, PageIntro, PlatformCard, StatusPill } from '../components/PlatformUi';

export default function PlatformIncomePage() {
  const { p } = usePlatformCopy();
  const timecards = usePlatformStore((state) => state.timecards);
  const confirmedMinutes = timecards
    .filter((card) => ['approved', 'corrected'].includes(card.status))
    .reduce((total, card) => total + (card.worked_minutes || 0), 0);
  const pendingMinutes = timecards
    .filter((card) => card.status === 'submitted')
    .reduce((total, card) => total + (card.worked_minutes || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.income} title={p.income_title} subtitle={p.income_sub} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <PlatformCard className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <IconTile icon="clock" tone="green" />
            <StatusPill tone="green">Подтверждено</StatusPill>
          </div>
          <div className="mt-6 font-head text-[38px] font-semibold tabular-nums text-green">
            {Math.floor(confirmedMinutes / 60)} ч {confirmedMinutes % 60} мин
          </div>
          <p className="mb-0 mt-2 text-[13px] text-muted">По одобренным и скорректированным табелям</p>
        </PlatformCard>
        <PlatformCard className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <IconTile icon="history" tone="orange" />
            <StatusPill tone="orange">На проверке</StatusPill>
          </div>
          <div className="mt-6 font-head text-[38px] font-semibold tabular-nums text-orange">
            {Math.floor(pendingMinutes / 60)} ч {pendingMinutes % 60} мин
          </div>
          <p className="mb-0 mt-2 text-[13px] text-muted">Ожидают решения менеджера</p>
        </PlatformCard>
      </div>
      <PlatformCard className="mt-4 p-5 sm:p-6">
        <p className="m-0 text-[13px] leading-relaxed text-muted">
          Денежный расчёт не показывается: источник ставок и официальный payroll ещё не подключены.
          Модуль дохода остаётся выключенным feature flag до проверки HR, Finance и Legal.
        </p>
      </PlatformCard>
    </div>
  );
}
