import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { LEARNING_COURSES } from '../platformData';
import { PLATFORM_ROUTES } from '../platformConfig';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, PlatformCard, ProgressBar, StatusPill } from '../components/PlatformUi';

export default function PlatformCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const course = useMemo(() => LEARNING_COURSES.find((item) => item.id === courseId), [courseId]);
  const record = usePlatformStore((state) => state.learningProgress[courseId]);
  const completeLearningModule = usePlatformStore((state) => state.completeLearningModule);
  const completeLearningAssessment = usePlatformStore((state) => state.completeLearningAssessment);
  const completedIds = record?.completedModuleIds || [];
  const firstIncomplete = course?.modules.find((module) => !completedIds.includes(module.id));
  const [activeModuleId, setActiveModuleId] = useState(firstIncomplete?.id || course?.modules[0]?.id);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [assessmentError, setAssessmentError] = useState('');

  useEffect(() => {
    if (!course) navigate(PLATFORM_ROUTES.learning, { replace: true });
  }, [course, navigate]);

  if (!course) return null;

  const activeIndex = course.modules.findIndex((module) => module.id === activeModuleId);
  const activeModule = course.modules[activeIndex] || course.modules[0];
  const progress = Math.round((completedIds.length / course.modules.length) * 100);
  const completed = completedIds.includes(activeModule.id);
  const isLastModule = activeIndex === course.modules.length - 1;

  async function finishModule() {
    try {
      if (!completed) await completeLearningModule(course.id, activeModule.id);
      const nextModule = course.modules[activeIndex + 1];
      if (nextModule) {
        setActiveModuleId(nextModule.id);
        showToast('Урок завершён, открыт следующий');
      } else {
        setAssessmentOpen(true);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  async function submitAssessment() {
    if (!answer) {
      setAssessmentError('Выберите один вариант ответа');
      return;
    }
    try {
      const result = await completeLearningAssessment(course.id, answer);
      if (!result.assessmentPassed) {
        setAssessmentError('Ответ неверный. Вернитесь к материалу и попробуйте ещё раз.');
        return;
      }
      setAssessmentError('');
      setAssessmentOpen(false);
      showToast('Проверка пройдена — курс завершён');
    } catch (error) {
      setAssessmentError(error.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro
        eyebrow={course.category}
        title={course.title}
        subtitle={course.description}
        action={course.required ? <StatusPill tone="orange">Обязательный курс</StatusPill> : <StatusPill tone="amber">Развитие</StatusPill>}
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside>
          <PlatformCard className="overflow-hidden lg:sticky lg:top-24">
            <div className="border-b border-line2 p-5">
              <ProgressBar value={progress} label="Прогресс курса" />
              <div className="mt-2 text-[11px] text-muted">{completedIds.length} из {course.modules.length} уроков завершено</div>
            </div>
            <div className="p-2" role="list" aria-label="Уроки курса">
              {course.modules.map((module, index) => {
                const isActive = module.id === activeModule.id;
                const isDone = completedIds.includes(module.id);
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setActiveModuleId(module.id)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${isActive ? 'bg-green-tint' : 'hover:bg-surface2'}`}
                  >
                    <span className={`grid h-8 w-8 flex-none place-items-center rounded-xl text-[11px] font-bold ${isDone ? 'bg-brand text-on-brand' : isActive ? 'bg-surface text-green' : 'bg-surface2 text-muted'}`}>
                      {isDone ? <Icon name="check" size={16} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold text-text">{module.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">{module.duration}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </PlatformCard>
        </aside>

        <PlatformCard className="overflow-hidden">
          <div className="relative min-h-[220px] overflow-hidden bg-brand p-6 text-on-brand sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10" />
            <div className="relative z-[1] flex h-full flex-col justify-between gap-10">
              <div className="flex items-start justify-between gap-4">
                <span className="text-[11px] font-bold uppercase tracking-[.12em] text-white/65">Урок {activeIndex + 1}</span>
                <IconTile icon={course.icon} tone="amber" />
              </div>
              <div>
                <h2 className="m-0 max-w-2xl font-head text-[27px] font-semibold leading-tight sm:text-[34px]">{activeModule.title}</h2>
                <div className="mt-3 flex items-center gap-2 text-[12px] text-white/70"><Icon name="clock" size={16} />{activeModule.duration}</div>
              </div>
            </div>
          </div>

          <article className="p-6 sm:p-8">
            <h3 className="m-0 font-head text-[21px] font-semibold text-text">Главное в этом уроке</h3>
            <p className="mb-0 mt-4 max-w-3xl text-[15px] leading-7 text-muted">{activeModule.body}</p>
            <div className="mt-6 rounded-2xl border border-line bg-surface2 p-4">
              <div className="flex gap-3">
                <Icon name="info" size={20} className="mt-0.5 flex-none text-green" />
                <div>
                  <div className="text-[13px] font-bold text-text">Примените на смене</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-muted">После урока обсудите этот шаг с менеджером смены и используйте его в ближайшей рабочей ситуации.</div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line2 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <PlatformButton variant="secondary" icon="chevronLeft" disabled={activeIndex === 0} onClick={() => setActiveModuleId(course.modules[activeIndex - 1].id)}>
                Предыдущий
              </PlatformButton>
              <PlatformButton icon={record?.assessmentPassed && isLastModule ? 'chevronLeft' : 'check'} onClick={() => record?.assessmentPassed && isLastModule ? navigate(PLATFORM_ROUTES.learning) : finishModule()}>
                {completed ? (isLastModule ? (record?.assessmentPassed ? 'Вернуться к курсам' : 'Пройти проверку') : 'Следующий урок') : 'Завершить урок'}
              </PlatformButton>
            </div>
          </article>
        </PlatformCard>
      </div>

      <PlatformModal
        open={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        title="Проверка знаний"
        subtitle={course.title}
        footer={<><PlatformButton variant="secondary" onClick={() => setAssessmentOpen(false)}>Вернуться к уроку</PlatformButton><PlatformButton icon="check" onClick={submitAssessment}>Проверить ответ</PlatformButton></>}
      >
        <fieldset>
          <legend className="font-head text-[19px] font-semibold leading-snug text-text">{course.assessment.question}</legend>
          <div className="mt-4 space-y-2">
            {course.assessment.options.map((option) => (
              <label key={option.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors ${answer === option.id ? 'border-green bg-green-tint' : 'border-line bg-surface hover:bg-surface2'}`}>
                <input type="radio" name="assessment-answer" value={option.id} checked={answer === option.id} onChange={(event) => { setAnswer(event.target.value); setAssessmentError(''); }} className="h-5 w-5 accent-green" />
                <span className="text-[13px] font-medium leading-relaxed text-text">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {assessmentError && <div role="alert" className="mt-4 rounded-2xl bg-red-tint p-3 text-[12px] leading-relaxed text-red">{assessmentError}</div>}
      </PlatformModal>
    </div>
  );
}
