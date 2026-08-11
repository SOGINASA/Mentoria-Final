import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { usePlatformStore } from '../../store/platformStore';
import { EMPLOYEE_SERVICES, LEARNING_COURSES } from '../platformData';
import { PLATFORM_ROUTES } from '../platformConfig';
import { IconTile, PageIntro, PlatformCard, SectionHeading } from '../components/PlatformUi';

export default function PlatformServicesPage() {
  const learningProgress = usePlatformStore((state) => state.learningProgress);
  const documentRequests = usePlatformStore((state) => state.documentRequests);
  const leaveRequests = usePlatformStore((state) => state.leaveRequests);
  const completedCourses = LEARNING_COURSES.filter((course) => (
    learningProgress[course.id]?.completedModuleIds?.length === course.modules.length
      && learningProgress[course.id]?.assessmentPassed
  )).length;
  const pendingRequests = [
    ...documentRequests.filter((request) => request.status === 'processing'),
    ...leaveRequests.filter((request) => request.status === 'pending'),
  ].length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow="Сервисы сотрудника"
        title="Всё необходимое для работы"
        subtitle="Обучение, кадровые документы, отпуск и обращения — с понятным статусом каждого действия."
      />

      <PlatformCard className="mt-6 grid grid-cols-3 divide-x divide-line2 overflow-hidden">
        {[
          ['Обучение', `${completedCourses}/${LEARNING_COURSES.length}`, 'курсов'],
          ['Отпуск', '12', 'дней'],
          ['Заявки', pendingRequests, 'в работе'],
        ].map(([label, value, meta]) => (
          <div key={label} className="min-w-0 px-3 py-4 text-center sm:px-5 sm:py-5">
            <div className="truncate text-[10px] font-bold uppercase tracking-[.08em] text-muted sm:text-[11px]">{label}</div>
            <div className="mt-1.5 font-head text-[23px] font-semibold tabular-nums text-text sm:text-[27px]">{value}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted sm:text-[11px]">{meta}</div>
          </div>
        ))}
      </PlatformCard>

      <section className="mt-8">
        <SectionHeading title="Все сервисы" />
        <div className="grid gap-3 md:grid-cols-2">
          {EMPLOYEE_SERVICES.map((service) => (
            <Link
              key={service.id}
              to={PLATFORM_ROUTES[service.routeKey]}
              className="group rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <PlatformCard className="flex min-h-[112px] items-center gap-4 p-4 transition-[background-color,border-color,box-shadow] duration-200 group-hover:border-green group-hover:bg-surface2 group-hover:shadow-card sm:p-5">
                <IconTile icon={service.icon} tone="green" />
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 font-head text-[19px] font-semibold text-text">{service.title}</h3>
                  <p className="mb-0 mt-1.5 text-[12px] leading-relaxed text-muted">{service.subtitle}</p>
                </div>
                <Icon name="chevronRight" size={19} className="flex-none text-faint transition-transform group-hover:translate-x-0.5" />
              </PlatformCard>
            </Link>
          ))}
        </div>
      </section>

      <PlatformCard className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-bold text-text">Нужен другой сервис?</div>
          <div className="mt-1 text-[12px] leading-relaxed text-muted">Создайте обращение — команда направит его ответственному подразделению.</div>
        </div>
        <Link to={PLATFORM_ROUTES.support} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-[13px] font-bold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2">
          <Icon name="send" size={18} />
          Создать обращение
        </Link>
      </PlatformCard>
    </div>
  );
}
