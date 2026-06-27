import { useEffect, useMemo, useState } from 'react';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useI18n } from '../../i18n/useI18n';
import { listWriteOffs } from '../../api/writeOffs.api';
import { STATUS_APPROVED, STATUS_PENDING, STATUS_REJECTED } from '../../constants/statuses';
import { TYPE_WITH_DEDUCTION } from '../../constants/writeOffTypes';

// Средняя оценочная стоимость одного списания (для оценки потерь в деньгах).
// Реальной цены в данных нет — это «примерная» оценка, легко поменять.
const AVG_LOSS = 1500; // ₸

const fmtMoney = (n) => `≈ ${Math.round(n).toLocaleString('ru-RU')} ₸`;

function topGroups(list, keyFn, limit = 6) {
  const map = new Map();
  list.forEach((w) => {
    const k = keyFn(w);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

export default function AdminAnalytics() {
  const { t, lang } = useI18n();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listWriteOffs({ per_page: 200 });
        if (alive) setList(data.write_offs || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const a = useMemo(() => {
    const total = list.length;
    const approved = list.filter((w) => w.status === STATUS_APPROVED).length;
    const pending = list.filter((w) => w.status === STATUS_PENDING).length;
    const rejected = list.filter((w) => w.status === STATUS_REJECTED).length;
    const withHold = list.filter((w) => w.type === TYPE_WITH_DEDUCTION);

    const byStore = topGroups(list, (w) => w.store?.name);
    const byEmployee = topGroups(withHold, (w) => w.deduction_employee?.full_name);

    // Динамика за 7 дней
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU', { day: '2-digit', month: '2-digit' });
      const count = list.filter((w) => {
        const c = new Date(w.created_at);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth() && c.getDate() === d.getDate();
      }).length;
      days.push({ label, count });
    }

    return {
      total,
      approved,
      pending,
      rejected,
      withHoldCount: withHold.length,
      lossTotal: total * AVG_LOSS,
      byStore,
      byEmployee,
      days,
      noHoldCount: total - withHold.length,
    };
  }, [list, lang]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );
  }
  if (a.total === 0) {
    return <EmptyState icon="list" title={t.an_empty} />;
  }

  const maxStore = Math.max(...a.byStore.map((s) => s.count), 1);
  const maxEmp = Math.max(...a.byEmployee.map((s) => s.count), 1);
  const maxDay = Math.max(...a.days.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Главная карточка потерь */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,var(--green),var(--green-d))', boxShadow: '0 14px 30px -12px var(--green)' }}
      >
        <div className="text-[13px] opacity-85">{t.an_loss_est}</div>
        <div className="font-head font-semibold text-[34px] leading-tight mt-1">{fmtMoney(a.lossTotal)}</div>
        <div className="text-[12px] opacity-75 mt-1">{t.an_loss_note}</div>
        <span className="absolute -right-6 -bottom-8 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,.07)' }} />
      </div>

      {/* KPI */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Kpi value={a.total} label={t.an_total} color="var(--text)" />
        <Kpi value={a.approved} label={t.an_approved} color="var(--gst)" />
        <Kpi value={a.pending} label={t.an_pending} color="var(--amber)" />
        <Kpi value={a.withHoldCount} label={t.an_with_hold} color="var(--orange)" />
      </div>

      {/* Потери по точкам */}
      <Section title={t.an_by_store}>
        {a.byStore.map((s) => (
          <BarRow key={s.name} label={s.name} count={s.count} money={fmtMoney(s.count * AVG_LOSS)} pct={(s.count / maxStore) * 100} color="var(--green)" t={t} />
        ))}
      </Section>

      {/* Удержания по сотрудникам */}
      {a.byEmployee.length > 0 && (
        <Section title={t.an_by_employee}>
          {a.byEmployee.map((s) => (
            <BarRow key={s.name} label={s.name} count={s.count} money={fmtMoney(s.count * AVG_LOSS)} pct={(s.count / maxEmp) * 100} color="var(--orange)" t={t} />
          ))}
        </Section>
      )}

      {/* По типу */}
      <Section title={t.an_by_type}>
        <BarRow label={t.type_hold} count={a.withHoldCount} pct={a.total ? (a.withHoldCount / a.total) * 100 : 0} color="var(--orange)" t={t} />
        <BarRow label={t.type_nohold} count={a.noHoldCount} pct={a.total ? (a.noHoldCount / a.total) * 100 : 0} color="var(--gst)" t={t} />
      </Section>

      {/* Динамика 7 дней */}
      <Section title={t.an_trend}>
        <div className="flex items-end gap-2 h-32 pt-2">
          {a.days.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                <div
                  className="w-full max-w-[34px] rounded-t-md transition-all"
                  style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 6 : 2, background: d.count ? 'var(--green)' : 'var(--line)' }}
                  title={`${d.count}`}
                />
              </div>
              <span className="text-[10px] text-faint tabular-nums">{d.count}</span>
              <span className="text-[10px] text-muted whitespace-nowrap">{d.label}</span>
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
