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
      {(wo.product_name || wo.items?.[0]?.product_name) && (
        <div className={row}>
          <span className="text-[13px] text-muted">{t.f_product}</span>
          <span className="text-[13px] text-text font-semibold text-right">{wo.product_name || wo.items[0].product_name}</span>
        </div>
      )}
      <div className={row}>
        <span className="text-[13px] text-muted">{t.f_type}</span>
        {typeAsBadge ? <TypeBadge type={wo.type} /> : (
          <span className="text-[13px] text-text font-semibold text-right">
            {wo.type === 'with_deduction' ? t.type_hold : t.type_nohold}
          </span>
        )}
      </div>
      {(wo.deduction_employees?.length || wo.deduction_employee) && (
        <div className={row}>
          <span className="text-[13px] text-muted">{t.f_emp}</span>
          <span className="text-[13px] text-text font-semibold text-right">{wo.deduct_all ? t.deduct_all_short : (wo.deduction_employees || [wo.deduction_employee]).map((e) => e.full_name).join(', ')}</span>
        </div>
      )}
      <div className="px-4 py-3.5">
        <div className="text-[13px] text-muted mb-1.5">{t.f_comment}</div>
        <div className="text-[13.5px] text-text leading-relaxed">{wo.comment}</div>
      </div>
    </div>
  );
}
