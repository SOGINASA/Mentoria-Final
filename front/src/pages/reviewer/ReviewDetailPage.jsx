import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../../components/ui/Spinner';
import Icon from '../../components/ui/Icon';
import BottomSheet from '../../components/ui/BottomSheet';
import BigPhoto from '../../components/writeoff/BigPhoto';
import InfoCard from '../../components/writeoff/InfoCard';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import { useWriteOffStore } from '../../store/writeOffStore';
import { initials, dateLabel } from '../../utils/format';
import { STATUS_PENDING } from '../../constants/statuses';
import { IIKO_SYNCED, IIKO_FAILED } from '../../constants/iiko';

export default function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const showToast = useUiStore((s) => s.showToast);
  const { current, currentLoading, acting, fetchOne, approve, reject, retryIiko, fetchStats } = useWriteOffStore();

  const [modal, setModal] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchOne(id);
  }, [id, fetchOne]);

  if (currentLoading || !current) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  const wo = current;
  const pending = wo.status === STATUS_PENDING;

  async function onApprove() {
    try {
      await approve(id);
      setModal(null);
      showToast(t.approved_toast);
      fetchStats();
      navigate('/review', { replace: true });
    } catch (e) {
      showToast(e.message || t.error_toast);
    }
  }

  async function onReject() {
    if (reason.trim().length < 5) return;
    try {
      await reject(id, reason.trim());
      setModal(null);
      showToast(t.rejected_toast);
      fetchStats();
      navigate('/review', { replace: true });
    } catch (e) {
      showToast(e.message || t.error_toast);
    }
  }

  return (
    <div className="relative min-h-full">
      <div className="p-5 pb-32 max-w-[1000px] mx-auto flex gap-6 flex-wrap">
        <div className="flex-[1.1] min-w-[280px]">
          <BigPhoto photos={wo.photos} showZoom />
        </div>

        <div className="flex-1 min-w-[280px] flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-full bg-green text-white grid place-items-center font-head font-semibold text-[15px]">
              {initials(wo.author?.full_name)}
            </div>
            <div>
              <div className="font-semibold text-[15px] text-text">{wo.author?.full_name}</div>
              <div className="text-xs text-muted">
                {t.author_label} · {dateLabel(wo.created_at, lang)}
              </div>
            </div>
          </div>

          <InfoCard wo={wo} typeAsBadge />

          {wo.iiko_sync_status === IIKO_SYNCED && (
            <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--gst-tint)', border: '1px solid var(--gst)' }}>
              <Icon name="shieldCheck" size={22} style={{ color: 'var(--gst)' }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--gst)' }}>
                  {t.iiko_done}
                </div>
                <div className="text-[11.5px] text-muted mt-px">{wo.iiko_act_id || t.iiko_done_sub}</div>
              </div>
            </div>
          )}

          {wo.iiko_sync_status === IIKO_FAILED && (
            <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'var(--red-tint)', border: '1px solid var(--red)' }}>
              <Icon name="shield" size={22} style={{ color: 'var(--red)' }} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--red)' }}>
                  {t.iiko_failed}
                </div>
                {wo.iiko_error && <div className="text-[11.5px] text-muted mt-px">{wo.iiko_error}</div>}
              </div>
              <button
                onClick={() => retryIiko(id)}
                disabled={acting}
                className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-surface border border-line cursor-pointer"
              >
                {t.iiko_retry}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* нижняя панель действий */}
      {pending && (
        <div className="absolute left-0 right-0 bottom-0 bg-surface border-t border-line px-5 py-3.5" style={{ boxShadow: '0 -8px 24px -12px rgba(0,0,0,.2)' }}>
          <div className="max-w-[1000px] mx-auto flex gap-3">
            <button
              onClick={() => {
                setReason('');
                setModal('reject');
              }}
              className="flex-1 h-[54px] rounded-2xl border-[1.5px] font-head font-semibold text-[17px] tracking-wide cursor-pointer flex items-center justify-center gap-2.5"
              style={{ borderColor: 'var(--red)', background: 'var(--red-tint)', color: 'var(--red)' }}
            >
              <Icon name="close" size={20} strokeWidth={2.4} />
              {t.reject}
            </button>
            <button
              onClick={() => setModal('approve')}
              className="flex-[1.4] h-[54px] rounded-2xl border-none text-white font-head font-semibold text-[17px] tracking-wide cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-105 transition"
              style={{ background: 'var(--gst)', boxShadow: '0 10px 22px -8px var(--gst)' }}
            >
              <Icon name="check" size={20} strokeWidth={2.6} />
              {t.approve}
            </button>
          </div>
        </div>
      )}

      {/* модалка подтверждения */}
      <BottomSheet open={modal === 'approve'} onClose={() => setModal(null)}>
        <div className="text-center">
          <div className="w-[62px] h-[62px] rounded-full grid place-items-center mx-auto mb-4" style={{ background: 'var(--gst-tint)' }}>
            <Icon name="shieldCheck" size={30} strokeWidth={2.2} style={{ color: 'var(--gst)' }} />
          </div>
          <h3 className="font-head font-semibold text-[21px] text-text m-0 mb-1.5">{t.approve_title}</h3>
          <p className="text-muted text-[13.5px] leading-relaxed m-0 mb-2">{t.approve_body}</p>
          <div className="flex items-center gap-2 justify-center rounded-xl p-2.5 mb-5" style={{ background: 'var(--gst-tint)' }}>
            <Icon name="shield" size={16} style={{ color: 'var(--gst)' }} />
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--gst)' }}>
              {t.iiko_will}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setModal(null)} className="flex-1 h-[50px] rounded-xl border-[1.5px] border-line bg-surface text-text font-semibold text-[14.5px] cursor-pointer">
            {t.cancel}
          </button>
          <button
            onClick={onApprove}
            disabled={acting}
            className="flex-[1.3] h-[50px] rounded-xl border-none text-white font-head font-semibold text-base cursor-pointer grid place-items-center"
            style={{ background: 'var(--gst)' }}
          >
            {acting ? <Spinner size={20} /> : t.approve}
          </button>
        </div>
      </BottomSheet>

      {/* модалка отклонения */}
      <BottomSheet open={modal === 'reject'} onClose={() => setModal(null)}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-[46px] h-[46px] rounded-[13px] grid place-items-center flex-none" style={{ background: 'var(--red-tint)' }}>
            <Icon name="close" size={24} strokeWidth={2.2} style={{ color: 'var(--red)' }} />
          </div>
          <div>
            <h3 className="font-head font-semibold text-[20px] text-text m-0">{t.reject_title}</h3>
            <p className="text-muted text-[12.5px] mt-0.5 m-0">{t.reject_body}</p>
          </div>
        </div>
        <div
          className="bg-surface2 border-[1.5px] rounded-xl p-3.5 mb-4 transition-colors"
          style={{ borderColor: reason.trim().length >= 5 ? 'var(--red)' : 'var(--line)' }}
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reject_ph}
            className="w-full min-h-[88px] border-none outline-none resize-none bg-transparent text-sm leading-relaxed text-text"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setModal(null)} className="flex-1 h-[50px] rounded-xl border-[1.5px] border-line bg-surface text-text font-semibold text-[14.5px] cursor-pointer">
            {t.cancel}
          </button>
          <button
            onClick={onReject}
            disabled={reason.trim().length < 5 || acting}
            className="flex-[1.3] h-[50px] rounded-xl border-none text-white font-head font-semibold text-base cursor-pointer grid place-items-center disabled:cursor-not-allowed"
            style={{ background: reason.trim().length >= 5 ? 'var(--red)' : 'var(--line)' }}
          >
            {acting ? <Spinner size={20} /> : t.reject}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
