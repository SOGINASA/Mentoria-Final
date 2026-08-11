import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { INITIAL_PLATFORM_TASKS } from '../platform/platformData';

function taskProgress(task) {
  if (task.done) return 100;
  if (!task.steps?.length) return null;
  const completed = task.steps.filter((step) => step.done).length;
  return Math.round((completed / task.steps.length) * 100);
}

function createReference(prefix) {
  const timePart = Date.now().toString(36).slice(-5).toUpperCase();
  return `${prefix}-${timePart}`;
}

const initialState = {
  shiftActive: false,
  tasks: INITIAL_PLATFORM_TASKS,
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
  contactDetails: {
    phone: '+7 707 000 24 10',
    email: 'employee@bahandi.kz',
  },
};

export const usePlatformStore = create(
  persist(
    (set) => ({
      ...initialState,

      setShiftActive(shiftActive) {
        set({ shiftActive });
      },

      toggleTask(taskId) {
        set((state) => ({
          tasks: state.tasks.map((task) => (
            task.id === taskId ? { ...task, done: !task.done } : task
          )),
        }));
      },

      completeTask(taskId) {
        set((state) => ({
          tasks: state.tasks.map((task) => (
            task.id === taskId ? { ...task, done: true } : task
          )),
        }));
      },

      toggleTaskStep(taskId, stepId) {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId || !task.steps) return task;
            const steps = task.steps.map((step) => (
              step.id === stepId ? { ...step, done: !step.done } : step
            ));
            return {
              ...task,
              steps,
              done: steps.every((step) => step.done),
            };
          }),
        }));
      },

      createShiftRequest(payload) {
        const request = {
          ...payload,
          id: createReference('BH-SH'),
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        set((state) => ({ shiftRequests: [request, ...state.shiftRequests] }));
        return request;
      },

      createSupportTicket(payload) {
        const ticket = {
          ...payload,
          id: createReference('BH-S'),
          createdAt: new Date().toISOString(),
          status: 'open',
        };
        set((state) => ({ supportTickets: [ticket, ...state.supportTickets] }));
        return ticket;
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
          return {
            learningProgress: {
              ...state.learningProgress,
              [courseId]: {
                ...current,
                assessmentPassed: score >= 80,
                assessmentScore: score,
                completedAt: score >= 80 ? new Date().toISOString() : current.completedAt,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      createDocumentRequest(payload) {
        const request = {
          ...payload,
          id: createReference('BH-D'),
          createdAt: new Date().toISOString(),
          status: 'processing',
        };
        set((state) => ({ documentRequests: [request, ...state.documentRequests] }));
        return request;
      },

      createLeaveRequest(payload) {
        const request = {
          ...payload,
          id: createReference('BH-L'),
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

      updateContactDetails(contactDetails) {
        set({ contactDetails });
      },

      resetPlatformState() {
        set(initialState);
      },
    }),
    {
      name: 'bahandi_staff_platform',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export { taskProgress };
