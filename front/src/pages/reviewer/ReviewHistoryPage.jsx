import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tabs from '../../components/ui/Tabs';
import RequestCard from '../../components/ui/RequestCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useI18n } from '../../i18n/useI18n';
import { useWriteOffStore } from '../../store/writeOffStore';
import { STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED } from '../../constants/statuses';

export default function ReviewHistoryPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { list, listLoading, fetchList } = useWriteOffStore();
  const [tab, setTab] = useState('all');

  useEffect(() => {
    fetchList({ status: tab === 'all' ? undefined : tab, per_page: 50 });
  }, [tab, fetchList]);

  // вкладка «Все» = все обработанные (без ожидающих)
  const items = useMemo(
    () => (tab === 'all' ? list.filter((wo) => wo.status !== STATUS_PENDING) : list),
    [list, tab]
  );

  const tabs = [
    { key: 'all', label: t.tab_all },
    { key: STATUS_APPROVED, label: t.st_approved_s },
    { key: STATUS_REJECTED, label: t.st_rejected_s },
  ];

  return (
    <div className="p-5 max-w-[1080px] mx-auto">
      <Tabs items={tabs} value={tab} onChange={setTab} />

      {listLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="history" title={t.empty_title} subtitle={t.queue_empty_sub} />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {items.map((wo) => (
            <RequestCard key={wo.id} wo={wo} variant="author" onClick={() => navigate(`/review/${wo.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
