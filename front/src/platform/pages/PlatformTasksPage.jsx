import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import {
  DetailRow,
  EmptyPlatformState,
  IconTile,
  PageIntro,
  PlatformButton,
  PlatformCard,
  ProgressBar,
  StatusPill,
} from '../components/PlatformUi';

const initialTasks = [
  { id: 1, titleKey: 'task_opening', subKey: 'task_opening_sub', type: 'checklist', icon: 'clipboard', tone: 'green', due: '09:30', progress: 57, done: false },
  { id: 2, titleKey: 'task_temp', subKey: 'task_temp_sub', type: 'operation', icon: 'clock', tone: 'orange', due: '10:00', done: false },
  { id: 3, titleKey: 'task_learn', subKey: 'task_learn_sub', type: 'learning', icon: 'book', tone: 'amber', due: 'Сегодня', done: false },
  { id: 4, title: 'Проверить маркировку заготовок', subtitle: 'Холодильная зона • 12 позиций', type: 'checklist', icon: 'checkCircle', tone: 'green', due: '11:30', done: true },
  { id: 5, title: 'Передать комментарий вечерней смене', subtitle: 'Оборудование и незакрытые вопросы', type: 'operation', icon: 'arrowSwap', tone: 'orange', due: '18:00', done: true },
];

export default function PlatformTasksPage() {
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  const showToast = useUiStore((s) => s.showToast);
  const [tab, setTab] = useState('active');
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState(null);
  const [steps, setSteps] = useState([true, true, true, true, false, false, false]);

  const filtered = useMemo(() => {
    if (tab === 'active') return tasks.filter((task) => !task.done);
    if (tab === 'completed') return tasks.filter((task) => task.done);
    return tasks;
  }, [tab, tasks]);

  const doneCount = tasks.filter((task) => task.done).length;
  const typeLabel = (type) => type === 'checklist' ? p.checklist : type === 'learning' ? p.learning : p.operation;

  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done, progress: task.done ? task.progress : 100 } : task));
    const target = tasks.find((task) => task.id === id);
    showToast(target?.done ? p.reopen : p.task_completed);
  }

  function toggleStep(index) {
    setSteps((current) => current.map((value, stepIndex) => stepIndex === index ? !value : value));
  }

  function completeSelectedTask() {
    if (!selectedTask) return;
    setTasks((current) => current.map((task) => task.id === selectedTask.id ? { ...task, done: true, progress: 100 } : task));
    setSelectedTask(null);
    showToast(p.task_completed);
  }

  return (
    <div className="mx-auto w-full max-w-[1250px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.tasks} title={p.tasks_title} subtitle={p.tasks_sub} />

      <PlatformCard className="mt-6 overflow-hidden p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <IconTile icon="clipboard" tone="green" />
              <div>
                <div className="font-head text-[22px] font-semibold text-text">{p.tasks_today}</div>
                <div className="mt-1 text-[12px] text-muted">{doneCount} / {tasks.length} {p.tasks_done}</div>
              </div>
            </div>
          </div>
          <ProgressBar value={Math.round((doneCount / tasks.length) * 100)} label={p.tasks_done} />
        </div>
      </PlatformCard>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={p.tasks_title}>
        {[
          ['active', p.active, tasks.filter((task) => !task.done).length],
          ['completed', p.completed, doneCount],
          ['all', p.all, tasks.length],
        ].map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`inline-flex min-h-11 flex-none items-center gap-2 rounded-2xl border px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === value ? 'border-green bg-green text-white' : 'border-line bg-surface text-muted hover:bg-surface2'}`}
          >
            {label}
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] ${tab === value ? 'bg-white/20 text-white' : 'bg-surface2 text-muted'}`}>{count}</span>
          </button>
        ))}
      </div>

      <div key={tab} className="platform-content-swap mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyPlatformState title={p.no_tasks} subtitle={p.no_tasks_sub} />
        ) : filtered.map((task) => (
          <PlatformCard key={task.id} className={`overflow-hidden p-4 transition-opacity sm:p-5 ${task.done ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3.5">
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className={`mt-0.5 grid h-11 w-11 flex-none place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${task.done ? 'border-green bg-green text-white' : 'border-line bg-surface text-faint hover:border-green hover:bg-green-tint hover:text-green'}`}
                aria-label={task.done ? p.reopen : p.mark_done}
                aria-pressed={task.done}
              >
                <Icon name={task.done ? 'check' : task.icon} size={20} />
              </button>
              <button type="button" onClick={() => setSelectedTask(task)} className="min-w-0 flex-1 cursor-pointer rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={task.tone}>{typeLabel(task.type)}</StatusPill>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-muted"><Icon name="clock" size={14} />{task.due}</span>
                </div>
                <h3 className={`mb-0 mt-3 text-[15px] font-semibold leading-snug text-text sm:text-[16px] ${task.done ? 'line-through' : ''}`}>{task.title || p[task.titleKey]}</h3>
                <p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted sm:text-[13px]">{task.subtitle || p[task.subKey]}</p>
                {task.progress != null && !task.done && <div className="mt-4 max-w-md"><ProgressBar value={task.progress} /></div>}
              </button>
              <button type="button" onClick={() => setSelectedTask(task)} className="hidden h-11 w-11 flex-none cursor-pointer place-items-center rounded-2xl text-faint hover:bg-surface2 hover:text-text active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green sm:grid" aria-label="Открыть задачу">
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          </PlatformCard>
        ))}
      </div>

      <PlatformCard variant="orangeTint" className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <IconTile icon="camera" tone="orange" />
          <div className="min-w-0 flex-1">
            <div className="font-head text-[19px] font-semibold text-text">{p.writeoff}</div>
            <p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted">Текущий рабочий сценарий остаётся доступен и открывается без изменений.</p>
          </div>
          <PlatformButton icon="chevronRight" onClick={() => navigate('/create')}>{p.writeoff}</PlatformButton>
        </div>
      </PlatformCard>

      <PlatformModal
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || p[selectedTask?.titleKey]}
        subtitle={selectedTask?.subtitle || p[selectedTask?.subKey]}
        size="lg"
        footer={<><PlatformButton variant="secondary" onClick={() => setSelectedTask(null)}>Закрыть</PlatformButton>{!selectedTask?.done && <PlatformButton icon="check" onClick={completeSelectedTask}>{p.mark_done}</PlatformButton>}</>}
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={selectedTask?.tone}>{typeLabel(selectedTask?.type)}</StatusPill>
              <StatusPill tone={selectedTask?.done ? 'green' : 'neutral'}>{selectedTask?.done ? p.completed : p.active}</StatusPill>
            </div>
            {selectedTask?.type === 'checklist' ? (
              <div className="mt-5 space-y-2">
                {['Проверить чистоту рабочей зоны', 'Запустить и проверить оборудование', 'Сверить температуру хранения', 'Подготовить расходные материалы', 'Проверить маркировку заготовок', 'Сверить остатки упаковки', 'Передать готовность менеджеру'].map((label, index) => (
                  <button key={label} type="button" onClick={() => toggleStep(index)} className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:scale-[.99] ${steps[index] ? 'border-green bg-green-tint' : 'border-line bg-surface hover:bg-surface2'}`}>
                    <span className={`grid h-7 w-7 flex-none place-items-center rounded-lg border ${steps[index] ? 'border-green bg-green text-white' : 'border-line bg-surface text-transparent'}`}><Icon name="check" size={15} strokeWidth={3} /></span>
                    <span className={`text-[13px] font-semibold ${steps[index] ? 'text-green line-through' : 'text-text'}`}>{label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-surface2 p-5">
                <div className="text-[13px] font-bold text-text">Что нужно сделать</div>
                <p className="mb-0 mt-2 text-[13px] leading-relaxed text-muted">Выполните задачу по стандарту точки. Если обнаружите отклонение, добавьте комментарий менеджеру перед завершением.</p>
              </div>
            )}
          </div>
          <aside className="rounded-2xl border border-line p-4">
            <DetailRow icon="clock" label="Срок" value={selectedTask?.due || 'Сегодня'} />
            <DetailRow icon="briefcase" label="Источник" value="Моя точка" />
            <DetailRow icon="user" label="Ответственный" value="Вы" />
          </aside>
        </div>
      </PlatformModal>
    </div>
  );
}
