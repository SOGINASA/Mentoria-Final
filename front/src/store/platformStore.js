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
