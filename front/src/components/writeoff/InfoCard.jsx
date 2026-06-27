import TypeBadge from '../ui/TypeBadge';
import { useI18n } from '../../i18n/useI18n';

// Карточка с данными заявки: точка / тип / сотрудник / комментарий.
export default function InfoCard({ wo, typeAsBadge = false }) {
  const { t } = useI18n();
  const row = 'flex justify-between gap-3 px-4 py-3.5 border-b border-line2';
  return (
    <div className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className={row}>
        <span className="text-[13px] text-muted">{t.f_point}</span>
        <span className="text-[13px] text-text font-semibold text-right">{wo.store?.name || '—'}</span>
      </div>
      <div className={row}>
        <span className="text-[13px] text-muted">{t.f_type}</span>
        {typeAsBadge ? <TypeBadge type={wo.type} /> : (
          <span className="text-[13px] text-text font-semibold text-right">
            {wo.type === 'with_deduction' ? t.type_hold : t.type_nohold}
          </span>
        )}
      </div>
      {wo.deduction_employee && (
        <div className={row}>
          <span className="text-[13px] text-muted">{t.f_emp}</span>
          <span className="text-[13px] text-text font-semibold text-right">{wo.deduction_employee.full_name}</span>
        </div>
      )}
      <div className="px-4 py-3.5">
        <div className="text-[13px] text-muted mb-1.5">{t.f_comment}</div>
        <div className="text-[13.5px] text-text leading-relaxed">{wo.comment}</div>
      </div>
    </div>
  );
}
