import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { taskProgress, usePlatformStore } from '../../store/platformStore';
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

export default function PlatformTasksPage() {
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  const showToast = useUiStore((s) => s.showToast);
  const [tab, setTab] = useState('active');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const tasks = usePlatformStore((state) => state.tasks);
  const toggleStoredTask = usePlatformStore((state) => state.toggleTask);
  const completeTask = usePlatformStore((state) => state.completeTask);
  const toggleTaskStep = usePlatformStore((state) => state.toggleTaskStep);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;

  const filtered = useMemo(() => {
    if (tab === 'active') return tasks.filter((task) => !task.done);
    if (tab === 'completed') return tasks.filter((task) => task.done);
    return tasks;
  }, [tab, tasks]);

  const doneCount = tasks.filter((task) => task.done).length;
  const typeLabel = (type) => type === 'checklist' ? p.checklist : type === 'learning' ? p.learning : p.operation;

  async function toggleTask(id) {
    const target = tasks.find((task) => task.id === id);
    try {
      await toggleStoredTask(id);
      showToast(target?.done ? p.reopen : p.task_completed);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function completeSelectedTask() {
    if (!selectedTask) return;
    try {
      await completeTask(selectedTask.id);
      setSelectedTaskId(null);
      showToast(p.task_completed);
    } catch (error) {
      showToast(error.message);
    }
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
          <ProgressBar value={tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0} label={p.tasks_done} />
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
            className={`inline-flex min-h-11 flex-none items-center gap-2 rounded-2xl border px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${tab === value ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-muted hover:bg-surface2'}`}
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
                className={`mt-0.5 grid h-11 w-11 flex-none place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${task.done ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-faint hover:border-green hover:bg-green-tint hover:text-green'}`}
                aria-label={task.done ? p.reopen : p.mark_done}
                aria-pressed={task.done}
              >
                <Icon name={task.done ? 'check' : task.icon} size={20} />
              </button>
              <button type="button" onClick={() => setSelectedTaskId(task.id)} className="min-w-0 flex-1 cursor-pointer rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={task.tone}>{typeLabel(task.type)}</StatusPill>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-muted"><Icon name="clock" size={14} />{task.due}</span>
                </div>
                <h3 className={`mb-0 mt-3 text-[15px] font-semibold leading-snug text-text sm:text-[16px] ${task.done ? 'line-through' : ''}`}>{task.title || p[task.titleKey]}</h3>
                <p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted sm:text-[13px]">{task.subtitle || p[task.subKey]}</p>
                {taskProgress(task) != null && !task.done && <div className="mt-4 max-w-md"><ProgressBar value={taskProgress(task)} /></div>}
              </button>
              <button type="button" onClick={() => setSelectedTaskId(task.id)} className="hidden h-11 w-11 flex-none cursor-pointer place-items-center rounded-2xl text-faint hover:bg-surface2 hover:text-text active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green sm:grid" aria-label="Открыть задачу">
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
        onClose={() => setSelectedTaskId(null)}
        title={selectedTask?.title || p[selectedTask?.titleKey]}
        subtitle={selectedTask?.subtitle || p[selectedTask?.subKey]}
        size="lg"
        footer={<><PlatformButton variant="secondary" onClick={() => setSelectedTaskId(null)}>Закрыть</PlatformButton>{!selectedTask?.done && <PlatformButton icon="check" onClick={completeSelectedTask}>{p.mark_done}</PlatformButton>}</>}
      >
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={selectedTask?.tone}>{typeLabel(selectedTask?.type)}</StatusPill>
              <StatusPill tone={selectedTask?.done ? 'green' : 'neutral'}>{selectedTask?.done ? p.completed : p.active}</StatusPill>
            </div>
            {selectedTask?.type === 'checklist' && selectedTask.steps?.length ? (
              <div className="mt-5 space-y-2">
                {selectedTask.steps.map((step) => (
                  <button key={step.id} type="button" onClick={() => toggleTaskStep(selectedTask.id, step.id).catch((error) => showToast(error.message))} className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:scale-[.99] ${step.done ? 'border-green bg-green-tint' : 'border-line bg-surface hover:bg-surface2'}`}>
                    <span className={`grid h-7 w-7 flex-none place-items-center rounded-lg border ${step.done ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-transparent'}`}><Icon name="check" size={15} strokeWidth={3} /></span>
                    <span className={`text-[13px] font-semibold ${step.done ? 'text-green line-through' : 'text-text'}`}>{step.title}</span>
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
