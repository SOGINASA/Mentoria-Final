import { useEffect, useState } from 'react';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useI18n } from '../../i18n/useI18n';
import { getAnalytics } from '../../api/writeOffs.api';

const TREND_DAYS = 7;

const fmtMoney = (n) => `≈ ${Math.round(n || 0).toLocaleString('ru-RU')} ₸`;

export default function AdminAnalytics() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getAnalytics({ days: TREND_DAYS });
        if (alive) setData(res);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!data || data.totals.total === 0) {
    return <EmptyState icon="list" title={t.an_empty} />;
  }

  const { totals, with_hold: withHold, no_hold: noHold, loss_total: lossTotal, by_store: byStore, by_employee: byEmployee, trend } = data;

  const fmtDay = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });

  const maxStore = Math.max(...byStore.map((s) => s.count), 1);
  const maxEmp = Math.max(...byEmployee.map((s) => s.count), 1);
  const maxDay = Math.max(...trend.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Главная карточка потерь */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,var(--green),var(--green-d))', boxShadow: '0 14px 30px -12px var(--green)' }}
      >
        <div className="text-[13px] opacity-85">{t.an_loss_est}</div>
        <div className="font-head font-semibold text-[34px] leading-tight mt-1">{fmtMoney(lossTotal)}</div>
        <div className="text-[12px] opacity-75 mt-1">{t.an_loss_note}</div>
        <span className="absolute -right-6 -bottom-8 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,.07)' }} />
      </div>

      {/* KPI */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Kpi value={totals.total} label={t.an_total} color="var(--text)" />
        <Kpi value={totals.approved} label={t.an_approved} color="var(--gst)" />
        <Kpi value={totals.pending} label={t.an_pending} color="var(--amber)" />
        <Kpi value={withHold} label={t.an_with_hold} color="var(--orange)" />
      </div>

      {/* Потери по точкам */}
      <Section title={t.an_by_store}>
        {byStore.map((s) => (
          <BarRow key={s.store_id} label={s.name} count={s.count} money={fmtMoney(s.loss)} pct={(s.count / maxStore) * 100} color="var(--green)" t={t} />
        ))}
      </Section>

      {/* Удержания по сотрудникам */}
      {byEmployee.length > 0 && (
        <Section title={t.an_by_employee}>
          {byEmployee.map((s) => (
            <BarRow key={s.employee_id} label={s.name} count={s.count} money={fmtMoney(s.loss)} pct={(s.count / maxEmp) * 100} color="var(--orange)" t={t} />
          ))}
        </Section>
      )}

      {/* По типу */}
      <Section title={t.an_by_type}>
        <BarRow label={t.type_hold} count={withHold} pct={totals.total ? (withHold / totals.total) * 100 : 0} color="var(--orange)" t={t} />
        <BarRow label={t.type_nohold} count={noHold} pct={totals.total ? (noHold / totals.total) * 100 : 0} color="var(--gst)" t={t} />
      </Section>

      {/* Динамика 7 дней */}
      <Section title={t.an_trend}>
        <div className="flex items-end gap-2 h-32 pt-2">
          {trend.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                <div
                  className="w-full max-w-[34px] rounded-t-md transition-all"
                  style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 6 : 2, background: d.count ? 'var(--green)' : 'var(--line)' }}
                  title={`${d.count}`}
                />
              </div>
              <span className="text-[10px] text-faint tabular-nums">{d.count}</span>
              <span className="text-[10px] text-muted whitespace-nowrap">{fmtDay(d.date)}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Kpi({ value, label, color }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-card-sm">
      <div className="font-head font-semibold text-[28px] leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-[11.5px] text-muted mt-1 font-medium">{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="text-xs text-faint font-semibold tracking-wide uppercase mb-3">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function BarRow({ label, count, money, pct, color, t }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] text-text font-medium truncate">{label}</span>
        <span className="text-[12px] text-muted whitespace-nowrap">
          {count} {t.an_writeoffs_n}
          {money ? ` · ${money}` : ''}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
      </div>
    </div>
  );
}
