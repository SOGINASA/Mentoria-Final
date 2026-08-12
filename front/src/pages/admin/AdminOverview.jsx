import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { getPlatformOverview } from '../../api/admin.api';
import { useUiStore } from '../../store/uiStore';

const ROLE_NAMES = {
  admin: 'Администраторы', reviewer: 'Проверяющие', manager: 'Менеджеры',
  sender: 'Сотрудники', hr: 'HR', finance: 'Финансы', operations: 'Операции',
};

export default function AdminOverview({ onNavigate }) {
  const showToast = useUiStore((state) => state.showToast);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getPlatformOverview());
    } catch (error) {
      showToast(error.message || 'Не удалось загрузить состояние платформы');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (!data) return <Retry onClick={load} />;

  const cards = [
    { icon: 'users', value: data.users.active, label: 'активных аккаунтов', detail: `${data.users.inactive} отключено`, target: 'users' },
    { icon: 'store', value: data.stores.active, label: 'активных точек', detail: `${data.stores.total} всего`, target: 'stores' },
    { icon: 'userCheck', value: data.employees.active, label: 'сотрудников в iiko', detail: 'активные записи', target: 'employees' },
    { icon: 'sliders', value: data.features.available, label: 'функций платформы', detail: `${data.features.configured} переопределено`, target: 'flags' },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[.12em] text-green">Система работает</div>
            <h2 className="mt-1 font-head text-[26px] font-semibold leading-tight text-text">Управление Staff Platform</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">Аккаунты, торговые точки, доступность сервисов и история административных действий собраны в одном месте.</p>
          </div>
          <button type="button" onClick={load} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[13px] font-bold text-text transition-colors hover:border-green hover:text-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
            <Icon name="refresh" size={18} /> Обновить
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <button key={card.label} type="button" onClick={() => onNavigate(card.target)} className="min-h-[138px] rounded-2xl border border-line bg-surface p-4 text-left shadow-card-sm transition duration-200 hover:-translate-y-0.5 hover:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-tint text-green"><Icon name={card.icon} size={20} /></span>
            <strong className="mt-3 block font-head text-[28px] leading-none text-text">{card.value}</strong>
            <span className="mt-1 block text-[12px] font-semibold text-text">{card.label}</span>
            <span className="mt-1 block text-[11px] text-muted">{card.detail}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-head text-[19px] font-semibold text-text">Роли и аккаунты</h3>
            <button type="button" onClick={() => onNavigate('users')} className="min-h-11 rounded-xl px-3 text-[12px] font-bold text-green hover:bg-green-tint">Управлять</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(data.users.by_role).sort((a, b) => (ROLE_NAMES[a[0]] || a[0]).localeCompare(ROLE_NAMES[b[0]] || b[0])).map(([role, count]) => (
              <div key={role} className="rounded-xl bg-surface2 px-3 py-3">
                <div className="text-[20px] font-bold text-text">{count}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted">{ROLE_NAMES[role] || role}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card-sm">
          <h3 className="font-head text-[19px] font-semibold text-text">Требует внимания</h3>
          {data.issues.length ? (
            <div className="mt-3 space-y-2">
              {data.issues.map((issue) => (
                <button key={issue.key} type="button" onClick={() => onNavigate(issue.target)} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-orange-tint px-3 text-left transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface font-bold text-orange">{issue.count}</span>
                  <span className="flex-1 text-[12px] font-semibold leading-snug text-text">{issue.title}</span>
                  <Icon name="chevronRight" size={17} className="text-orange" />
                </button>
              ))}
            </div>
          ) : <div className="mt-4 flex items-center gap-3 rounded-xl bg-green-tint p-4 text-[13px] font-semibold text-green"><Icon name="checkCircle" size={20} /> Критичных настроек не пропущено</div>}
          <div className="mt-4 border-t border-line pt-4">
            {data.integrations.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${item.status === 'connected' ? 'bg-green' : 'bg-orange'}`} />
                <div><div className="text-[13px] font-bold text-text">{item.name}</div><div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{item.detail}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Retry({ onClick }) {
  return <div className="rounded-2xl border border-line bg-surface p-8 text-center"><p className="text-sm text-muted">Сводка временно недоступна</p><button type="button" onClick={onClick} className="mt-3 min-h-11 rounded-xl bg-green px-4 text-sm font-bold text-white">Повторить</button></div>;
}
