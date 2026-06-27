import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tabs from '../../components/ui/Tabs';
import RequestCard from '../../components/ui/RequestCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import { useI18n } from '../../i18n/useI18n';
import { useWriteOffStore } from '../../store/writeOffStore';
import { STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED } from '../../constants/statuses';

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { list, listLoading, fetchList, fetchStats } = useWriteOffStore();
  const [tab, setTab] = useState('all');

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchList({ status: tab === 'all' ? undefined : tab, per_page: 50 });
  }, [tab, fetchList]);

  const tabs = [
    { key: 'all', label: t.tab_all },
    { key: STATUS_DRAFT, label: t.st_draft_s },
    { key: STATUS_PENDING, label: t.st_pending_s },
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
      ) : list.length === 0 ? (
        <EmptyState
          icon="list"
          title={t.empty_title}
          subtitle={t.empty_sub}
          action={<Button onClick={() => navigate('/create')}>{t.create_cta}</Button>}
        />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {list.map((wo) => (
            <RequestCard key={wo.id} wo={wo} onClick={() => navigate(`/my-requests/${wo.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
