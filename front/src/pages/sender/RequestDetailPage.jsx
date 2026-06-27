import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import BigPhoto from '../../components/writeoff/BigPhoto';
import InfoCard from '../../components/writeoff/InfoCard';
import Timeline from '../../components/writeoff/Timeline';
import { useI18n } from '../../i18n/useI18n';
import { useWriteOffStore } from '../../store/writeOffStore';
import { STATUS_REJECTED } from '../../constants/statuses';

export default function RequestDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { current, currentLoading, fetchOne } = useWriteOffStore();

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

  return (
    <div className="p-5 max-w-[1000px] mx-auto flex gap-6 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <BigPhoto photos={wo.photos} />
      </div>
      <div className="flex-[1.1] min-w-[280px] flex flex-col gap-4">
        <div>
          <StatusBadge status={wo.status} size="md" />
        </div>

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
