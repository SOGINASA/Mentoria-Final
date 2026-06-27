import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import RequestCard from '../../components/ui/RequestCard';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { useWriteOffStore } from '../../store/writeOffStore';

export default function SenderHomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const { stats, list, listLoading, fetchStats, fetchList } = useWriteOffStore();

  useEffect(() => {
    fetchStats();
    fetchList({ per_page: 5 });
  }, [fetchStats, fetchList]);

  const counters = [
    { value: stats.pending, label: t.st_pending, color: 'var(--amber)' },
    { value: stats.approved, label: t.st_approved_s, color: 'var(--gst)' },
    { value: stats.rejected, label: t.st_rejected_s, color: 'var(--red)' },
  ];

  return (
    <div className="p-5 max-w-[1080px] mx-auto">
      <p className="text-muted text-sm mb-0.5">{t.greeting}</p>
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        <h1 className="font-head font-semibold text-[26px] text-text m-0">{user?.full_name}</h1>
        {user?.store?.name && (
          <span
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'var(--green-tint)', color: 'var(--green)' }}
          >
            <Icon name="pin" size={13} />
            {user.store.name}
          </span>
        )}
      </div>

      {stats.draft > 0 && (
        <button
          onClick={() => navigate('/my-requests')}
          className="w-full flex items-center gap-3 rounded-2xl p-3.5 mb-4 text-left cursor-pointer hover:-translate-y-0.5 transition"
          style={{ background: 'var(--amber-tint)', border: '1px solid var(--amber)' }}
        >
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-none text-white" style={{ background: 'var(--amber)' }}>
            <Icon name="bell" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] text-text">{t.draft_alert_title}</div>
            <div className="text-[12.5px] text-muted">{t.draft_alert_sub.replace('{n}', stats.draft)}</div>
          </div>
          <Icon name="chevronRight" size={18} strokeWidth={2.2} className="text-faint flex-none" />
        </button>
      )}

      <div className="flex gap-5 items-start flex-wrap">
        {/* левая колонка: счётчики + CTA */}
        <div className="flex-1 min-w-[280px] flex flex-col gap-3.5">
          <div className="flex gap-2.5">
            {counters.map((c) => (
              <div key={c.label} className="flex-1 bg-surface border border-line rounded-2xl p-3.5 shadow-card-sm">
                <div className="font-head font-semibold text-[28px] leading-none" style={{ color: c.color }}>
                  {c.value}
                </div>
                <div className="text-[11.5px] text-muted mt-1 font-medium">{c.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/create')}
            className="relative overflow-hidden border-none cursor-pointer rounded-[18px] p-5.5 text-left flex items-center gap-4 text-white
              hover:-translate-y-0.5 active:scale-[.99] transition"
            style={{
              padding: 22,
              background: 'linear-gradient(135deg,var(--green),var(--green-d))',
              boxShadow: '0 14px 30px -10px var(--green)',
            }}
          >
            <div className="w-[52px] h-[52px] flex-none rounded-[15px] grid place-items-center" style={{ background: 'rgba(255,255,255,.16)' }}>
              <Icon name="plus" size={28} strokeWidth={2.4} />
            </div>
            <div className="flex-1">
              <div className="font-head font-semibold text-[21px] tracking-wide">{t.create_cta}</div>
              <div className="text-[13px] opacity-80 mt-0.5">{t.create_cta_sub}</div>
            </div>
            <Icon name="chevronRight" size={22} strokeWidth={2.4} className="opacity-70" />
            <span className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,.06)' }} />
          </button>
        </div>

        {/* правая колонка: последние заявки */}
        <div className="flex-[1.3] min-w-[300px] w-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-head font-semibold text-base text-text m-0 tracking-wide">{t.recent}</h3>
            <button onClick={() => navigate('/my-requests')} className="border-none bg-transparent text-green font-semibold text-[13px] cursor-pointer">
              {t.see_all}
            </button>
          </div>

          {listLoading ? (
            <div className="grid place-items-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {list.slice(0, 5).map((wo) => (
                <RequestCard key={wo.id} wo={wo} onClick={() => navigate(`/my-requests/${wo.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
