import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as platformApi from '../api/platform.api';
import * as shiftsApi from '../api/shifts.api';
import * as timeApi from '../api/time.api';
import * as tasksApi from '../api/tasks.api';
import * as casesApi from '../api/cases.api';
import * as newsApi from '../api/news.api';

function taskProgress(task) {
  if (task.done) return 100;
  if (task.progress != null) return task.progress;
  if (!task.steps?.length) return null;
  const completed = task.steps.filter((step) => step.done).length;
  return Math.round((completed / task.steps.length) * 100);
}

function idempotencyKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localReference(prefix) {
  const timePart = Date.now().toString(36).slice(-5).toUpperCase();
  return `${prefix}-${timePart}`;
}

const initialState = {
  hydrated: false,
  loading: false,
  error: null,
  shiftActive: false,
  timeState: 'idle',
  shifts: [],
  openShifts: [],
  tasks: [],
  shiftRequests: [],
  supportTickets: [],
  learningProgress: {},
  documentRequests: [],
  leaveRequests: [
    {
      id: 'BH-L-2409',
      type: 'annual',
      typeLabel: 'Ежегодный оплачиваемый отпуск',
      startDate: '2026-09-02',
      endDate: '2026-09-08',
      days: 7,
      comment: '',
      createdAt: '2026-07-18T09:30:00+06:00',
      status: 'approved',
    },
  ],
  news: [],
  timecards: [],
  featureFlags: {
    staff_platform: true,
    shifts: true,
    time_tracking: true,
    tasks: true,
    support_cases: true,
    news: true,
    income: false,
    hr_services: false,
  },
  permissions: [],
  contactDetails: { phone: '', email: '' },
};

export const usePlatformStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      async hydrate() {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const bootstrap = await platformApi.bootstrap();
          const [open, requests, cases, news, timecards] = await Promise.all([
            shiftsApi.listOpen(), shiftsApi.listRequests(), casesApi.list(), newsApi.list(),
            timeApi.listTimecards(),
          ]);
          const state = bootstrap.time_tracking?.state || 'idle';
          set({
            hydrated: true,
            loading: false,
            shifts: bootstrap.shifts || [],
            tasks: bootstrap.tasks || [],
            openShifts: open.shifts || [],
            shiftRequests: requests.requests || [],
            supportTickets: cases.cases || [],
            news: news.news || [],
            timecards: timecards.timecards || [],
            featureFlags: bootstrap.feature_flags || {},
            permissions: bootstrap.permissions || [],
            contactDetails: {
              phone: bootstrap.user?.phone || '',
              email: bootstrap.user?.email || '',
            },
            timeState: state,
            shiftActive: state !== 'idle',
          });
        } catch (error) {
          set({ loading: false, error: error.message || 'Не удалось загрузить данные платформы' });
          throw error;
        }
      },

      async toggleShift() {
        const { timeState, shifts } = get();
        if (timeState === 'break_start') throw new Error('Сначала завершите перерыв');
        const eventType = timeState === 'idle' ? 'clock_in' : 'clock_out';
        const currentShift = shifts.find((shift) => {
          const now = Date.now();
          return new Date(shift.starts_at).getTime() <= now && new Date(shift.ends_at).getTime() >= now;
        }) || shifts[0];
        const result = await timeApi.createEvent({
          event_type: eventType,
          shift_id: currentShift?.id,
          store_id: currentShift?.store_id,
          method: 'device',
        }, idempotencyKey());
        const nextState = eventType === 'clock_out' ? 'idle' : eventType;
        set((state) => ({
          timeState: nextState,
          shiftActive: nextState !== 'idle',
          timecards: result.timecard
            ? [result.timecard, ...state.timecards.filter((item) => item.id !== result.timecard.id)]
            : state.timecards,
        }));
        return result;
      },

      // Retained for callers that only need to mirror server state.
      setShiftActive(shiftActive) {
        set({ shiftActive, timeState: shiftActive ? 'clock_in' : 'idle' });
      },

      async toggleTask(taskId) {
        const target = get().tasks.find((task) => task.id === taskId);
        if (!target) return null;
        const previous = get().tasks;
        set({ tasks: previous.map((task) => task.id === taskId ? { ...task, done: !task.done } : task) });
        try {
          const result = target.done ? await tasksApi.reopen(taskId) : await tasksApi.complete(taskId);
          set((state) => ({ tasks: state.tasks.map((task) => task.id === taskId ? result.task : task) }));
          return result.task;
        } catch (error) {
          set({ tasks: previous, error: error.message });
          throw error;
        }
      },

      async completeTask(taskId) {
        const result = await tasksApi.complete(taskId);
        set((state) => ({ tasks: state.tasks.map((task) => task.id === taskId ? result.task : task) }));
        return result.task;
      },

      async toggleTaskStep(taskId, stepId) {
        const task = get().tasks.find((item) => item.id === taskId);
        const step = task?.steps?.find((item) => item.id === stepId);
        if (!step) return null;
        const result = await tasksApi.updateStep(taskId, stepId, { done: !step.done });
        set((state) => ({ tasks: state.tasks.map((item) => item.id === taskId ? result.task : item) }));
        return result.task;
      },

      async createShiftRequest(payload) {
        const shiftId = payload.shiftId || payload.shift?.id;
        if (!shiftId) throw new Error('Смена не выбрана');
        const result = await shiftsApi.createRequest(shiftId, {
          request_type: payload.type || payload.request_type,
          target_shift_id: payload.targetShiftId,
          comment: payload.comment,
        });
        set((state) => ({ shiftRequests: [result.request, ...state.shiftRequests
          .filter((item) => item.id !== result.request.id)] }));
        return result.request;
      },

      async createSupportTicket(payload) {
        const result = await casesApi.create({
          category: payload.category,
          subject: payload.subject || payload.message.slice(0, 80),
          message: payload.message,
        });
        set((state) => ({ supportTickets: [result.case, ...state.supportTickets] }));
        return { ...result.case, id: result.case.reference };
      },

      async updateContactDetails(contactDetails) {
        const result = await platformApi.updateProfile(contactDetails);
        const next = { phone: result.user.phone || '', email: result.user.email || '' };
        set({ contactDetails: next });
        return next;
      },

      async markNewsRead(postId) {
        await newsApi.markRead(postId);
        set((state) => ({ news: state.news.map((post) => post.id === postId
          ? { ...post, is_read: true } : post) }));
      },

      completeLearningModule(courseId, moduleId) {
        set((state) => {
          const current = state.learningProgress[courseId] || { completedModuleIds: [] };
          if (current.completedModuleIds.includes(moduleId)) return state;
          return {
            learningProgress: {
              ...state.learningProgress,
              [courseId]: {
                ...current,
                completedModuleIds: [...current.completedModuleIds, moduleId],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      completeLearningAssessment(courseId, score) {
        set((state) => {
          const current = state.learningProgress[courseId] || { completedModuleIds: [] };
          const passed = score >= 80;
          return {
            learningProgress: {
              ...state.learningProgress,
              [courseId]: {
                ...current,
                assessmentPassed: passed,
                assessmentScore: score,
                completedAt: passed ? new Date().toISOString() : current.completedAt,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      createDocumentRequest(payload) {
        const request = {
          ...payload,
          id: localReference('BH-D'),
          createdAt: new Date().toISOString(),
          status: 'processing',
        };
        set((state) => ({ documentRequests: [request, ...state.documentRequests] }));
        return request;
      },

      createLeaveRequest(payload) {
        const request = {
          ...payload,
          id: localReference('BH-L'),
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        set((state) => ({ leaveRequests: [request, ...state.leaveRequests] }));
        return request;
      },

      cancelLeaveRequest(requestId) {
        set((state) => ({
          leaveRequests: state.leaveRequests.map((request) => (
            request.id === requestId && request.status === 'pending'
              ? { ...request, status: 'cancelled' }
              : request
          )),
        }));
      },

      resetPlatformState() {
        set(initialState);
      },
    }),
    {
      name: 'bahandi_staff_platform',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        shifts: state.shifts,
        tasks: state.tasks,
        featureFlags: state.featureFlags,
        contactDetails: state.contactDetails,
        learningProgress: state.learningProgress,
        documentRequests: state.documentRequests,
        leaveRequests: state.leaveRequests,
      }),
    },
  ),
);

export { taskProgress };
