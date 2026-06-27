import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import BigPhoto from '../../components/writeoff/BigPhoto';
import InfoCard from '../../components/writeoff/InfoCard';
import Timeline from '../../components/writeoff/Timeline';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import { useWriteOffStore } from '../../store/writeOffStore';
import { STATUS_DRAFT, STATUS_REJECTED } from '../../constants/statuses';

export default function RequestDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const showToast = useUiStore((s) => s.showToast);
  const { current, currentLoading, acting, fetchOne, confirmDraft, fetchStats } = useWriteOffStore();
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchOne(id);
  }, [id, fetchOne]);

  // Префилл комментария авто-черновика для редактирования перед подтверждением.
  useEffect(() => {
    if (current?.status === STATUS_DRAFT) setComment(current.comment || '');
  }, [current]);

  if (currentLoading || !current) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  const wo = current;
  const commentValid = comment.trim().length >= 10;

  const onConfirm = async () => {
    if (!commentValid) return;
    try {
      const payload = comment.trim() !== (wo.comment || '') ? { comment: comment.trim() } : {};
      await confirmDraft(wo.id, payload);
      showToast(t.confirm_toast);
      fetchOne(id); // обновим — статус станет pending, панель исчезнет
      fetchStats(); // обновим бейдж черновиков в навигации
    } catch {
      showToast(t.error_toast);
    }
  };

  return (
    <div className="p-5 max-w-[1000px] mx-auto flex gap-6 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <BigPhoto photos={wo.photos} />
      </div>
      <div className="flex-[1.1] min-w-[280px] flex flex-col gap-4">
        <div>
          <StatusBadge status={wo.status} size="md" />
        </div>

        {wo.status === STATUS_DRAFT && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--amber-tint)', border: '1px solid var(--amber)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name="bell" size={16} style={{ color: 'var(--amber)' }} />
              <div className="font-semibold text-[14px] text-text">{t.draft_confirm_title}</div>
            </div>
            <p className="text-[12.5px] text-muted m-0 mb-3 leading-snug">{t.draft_confirm_sub}</p>

            <label className="text-[12px] font-semibold text-muted">{t.f_comment}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-xl border border-line bg-surface p-2.5 text-[13.5px] text-text resize-none outline-none focus:border-green"
            />
            <div
              className="text-[11.5px] mt-1 mb-3 font-medium"
              style={{ color: commentValid ? 'var(--gst)' : 'var(--red)' }}
            >
              {commentValid ? t.comment_ok : t.comment_need}
            </div>

            <Button onClick={onConfirm} loading={acting} disabled={!commentValid} className="w-full">
              <Icon name="check" size={18} strokeWidth={2.6} />
              {t.draft_confirm_cta}
            </Button>
          </div>
        )}

        {wo.status === STATUS_REJECTED && wo.rejection_reason && (
          <div className="rounded-2xl p-3.5" style={{ background: 'var(--red-tint)', border: '1px solid var(--red)' }}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--red)' }}>
              {t.reject_reason}
            </div>
            <div className="text-[13.5px] text-text leading-snug">{wo.rejection_reason}</div>
          </div>
        )}

        <InfoCard wo={wo} />
        <Timeline wo={wo} />
      </div>
    </div>
  );
}
