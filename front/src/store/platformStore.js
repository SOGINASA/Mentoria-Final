import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as platformApi from '../api/platform.api';
import * as shiftsApi from '../api/shifts.api';
import * as timeApi from '../api/time.api';
import * as tasksApi from '../api/tasks.api';
import * as casesApi from '../api/cases.api';
import * as newsApi from '../api/news.api';
import * as employeeServicesApi from '../api/employeeServices.api';

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

const LEAVE_TYPE_LABELS = {
  annual: 'Ежегодный оплачиваемый отпуск',
  unpaid: 'Отпуск без сохранения зарплаты',
  sick: 'Больничный',
  other: 'Другое отсутствие',
};

function normalizeLearningProgress(items = []) {
  return Object.fromEntries(items.map((item) => [item.course_id, {
    completedModuleIds: item.completed_module_ids || [],
    assessmentScore: item.assessment_score,
    assessmentPassed: Boolean(item.assessment_passed),
    completedAt: item.completed_at,
    updatedAt: item.updated_at,
  }]));
}

function normalizeDocumentRequest(item) {
  return {
    id: item.reference,
    requestId: item.request_id,
    documentId: item.document_id,
    title: item.title,
    status: item.status,
    fileUrl: item.file_url,
    version: item.version,
    createdAt: item.created_at,
  };
}

function normalizeLeaveRequest(item) {
  return {
    id: item.reference,
    requestId: item.request_id,
    type: item.leave_type,
    typeLabel: LEAVE_TYPE_LABELS[item.leave_type] || item.leave_type,
    startDate: item.starts_on,
    endDate: item.ends_on,
    days: item.days,
    comment: item.comment || '',
    status: item.status,
    version: item.version,
    createdAt: item.created_at,
  };
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
  leaveRequests: [],
  leaveBalance: {
    annual_allowance_days: 0,
    external_used_days: 0,
    approved_days: 0,
    available_days: 0,
    preliminary: true,
  },
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
          const employeeServices = bootstrap.employee_services || {};
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
            learningProgress: normalizeLearningProgress(employeeServices.learning_progress),
            documentRequests: (employeeServices.document_requests || []).map(normalizeDocumentRequest),
            leaveRequests: (employeeServices.leave_requests || []).map(normalizeLeaveRequest),
            leaveBalance: employeeServices.leave_balance || initialState.leaveBalance,
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

      async completeLearningModule(courseId, moduleId) {
        const result = await employeeServicesApi.completeModule(courseId, moduleId);
        const normalized = normalizeLearningProgress([result.progress]);
        set((state) => ({ learningProgress: { ...state.learningProgress, ...normalized } }));
        return normalized[courseId];
      },

      async completeLearningAssessment(courseId, answer) {
        const result = await employeeServicesApi.completeAssessment(courseId, answer);
        const normalized = normalizeLearningProgress([result.progress]);
        set((state) => ({ learningProgress: { ...state.learningProgress, ...normalized } }));
        return normalized[courseId];
      },

      async createDocumentRequest(payload) {
        const result = await employeeServicesApi.createDocumentRequest(payload.documentId);
        const request = normalizeDocumentRequest(result.request);
        set((state) => ({ documentRequests: [request, ...state.documentRequests
          .filter((item) => item.requestId !== request.requestId)] }));
        return request;
      },

      async createLeaveRequest(payload) {
        const result = await employeeServicesApi.createLeaveRequest({
          leave_type: payload.type,
          starts_on: payload.startDate,
          ends_on: payload.endDate,
          comment: payload.comment,
        });
        const request = normalizeLeaveRequest(result.request);
        set((state) => ({
          leaveRequests: [request, ...state.leaveRequests],
          leaveBalance: result.leave_balance || state.leaveBalance,
        }));
        return request;
      },

      async cancelLeaveRequest(requestId) {
        const current = get().leaveRequests.find((item) => item.id === requestId);
        if (!current) return null;
        const result = await employeeServicesApi.cancelLeaveRequest(
          current.requestId, current.version,
        );
        const request = normalizeLeaveRequest(result.request);
        set((state) => ({
          leaveRequests: state.leaveRequests.map((item) => (
            item.requestId === request.requestId ? request : item
          )),
          leaveBalance: result.leave_balance || state.leaveBalance,
        }));
        return request;
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
        leaveBalance: state.leaveBalance,
      }),
    },
  ),
);

export { taskProgress };
