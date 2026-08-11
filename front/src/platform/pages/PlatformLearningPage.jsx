import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { usePlatformStore } from '../../store/platformStore';
import { LEARNING_COURSES } from '../platformData';
import { PLATFORM_ROUTES } from '../platformConfig';
import { IconTile, PageIntro, PlatformCard, ProgressBar, StatusPill } from '../components/PlatformUi';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'required', label: 'Обязательные' },
  { id: 'active', label: 'В процессе' },
  { id: 'completed', label: 'Пройденные' },
];

function getCourseProgress(course, record) {
  const completed = record?.completedModuleIds?.length || 0;
  return Math.round((completed / course.modules.length) * 100);
}

function isCourseCompleted(course, record) {
  return getCourseProgress(course, record) === 100 && Boolean(record?.assessmentPassed);
}

export default function PlatformLearningPage() {
  const [filter, setFilter] = useState('all');
  const learningProgress = usePlatformStore((state) => state.learningProgress);
  const courses = useMemo(() => LEARNING_COURSES.filter((course) => {
    const progress = getCourseProgress(course, learningProgress[course.id]);
    if (filter === 'required') return course.required;
    if (filter === 'active') return progress > 0 && progress < 100;
    if (filter === 'completed') return isCourseCompleted(course, learningProgress[course.id]);
    return true;
  }), [filter, learningProgress]);

  const finished = LEARNING_COURSES.filter((course) => isCourseCompleted(course, learningProgress[course.id])).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow="Развитие"
        title="Обучение и допуски"
        subtitle="Проходите обязательные программы в удобном темпе и следите за действующими допусками."
      />

      <PlatformCard variant="brand" className="relative mt-6 overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.12em] text-white/70">Мой прогресс</div>
            <div className="mt-2 font-head text-[27px] font-semibold">{finished} из {LEARNING_COURSES.length} курсов</div>
            <p className="mb-0 mt-2 max-w-xl text-[12px] leading-relaxed text-white/70">Завершённые уроки сохраняются автоматически. К курсу можно вернуться в любое удобное время.</p>
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-[24px] bg-white/10 font-head text-[24px] font-semibold">
            {Math.round((finished / LEARNING_COURSES.length) * 100)}%
          </div>
        </div>
      </PlatformCard>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Фильтр курсов">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={`min-h-11 flex-none rounded-2xl border px-4 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${filter === item.id ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-muted hover:bg-surface2 hover:text-text'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {courses.map((course) => {
          const progress = getCourseProgress(course, learningProgress[course.id]);
          const isCompleted = isCourseCompleted(course, learningProgress[course.id]);
          const status = isCompleted ? 'Пройдено' : progress === 100 ? 'Проверка знаний' : progress > 0 ? 'В процессе' : 'Не начат';
          return (
            <Link key={course.id} to={`${PLATFORM_ROUTES.learning}/${course.id}`} className="group rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              <PlatformCard className="flex h-full flex-col p-5 transition-[transform,border-color,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-green group-hover:shadow-card group-active:translate-y-0">
                <div className="flex items-start gap-4">
                  <IconTile icon={course.icon} tone={course.tone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={isCompleted ? 'green' : progress > 0 ? 'amber' : 'neutral'}>{status}</StatusPill>
                      {course.required && <span className="text-[10px] font-bold uppercase tracking-[.08em] text-orange">Обязательный</span>}
                    </div>
                    <h2 className="mb-0 mt-3 font-head text-[20px] font-semibold text-text">{course.title}</h2>
                  </div>
                  <Icon name="chevronRight" size={19} className="flex-none text-faint transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mb-0 mt-3 flex-1 text-[12px] leading-relaxed text-muted">{course.description}</p>
                <div className="mt-5">
                  <ProgressBar value={progress} label={`${course.modules.length} урока`} tone={course.tone === 'orange' ? 'orange' : course.tone === 'amber' ? 'amber' : 'green'} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line2 pt-4 text-[11px] text-muted">
                  <span>{course.category}</span>
                  <span className="font-semibold text-text">{isCompleted ? 'Повторить' : progress === 100 ? 'Пройти проверку' : progress > 0 ? 'Продолжить' : 'Начать'}</span>
                </div>
              </PlatformCard>
            </Link>
          );
        })}
      </div>

      {!courses.length && (
        <PlatformCard className="mt-4 p-8 text-center">
          <IconTile icon="checkCircle" tone="neutral" />
          <h2 className="mb-1 mt-4 font-head text-xl font-semibold text-text">В этой категории пока пусто</h2>
          <p className="m-0 text-sm text-muted">Выберите другой фильтр, чтобы увидеть доступные курсы.</p>
        </PlatformCard>
      )}
    </div>
  );
}
