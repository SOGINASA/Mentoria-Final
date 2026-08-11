import { taskProgress, usePlatformStore } from './platformStore';

describe('platformStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlatformStore.getState().resetPlatformState();
  });

  test('keeps task progress and completion in sync', () => {
    const store = usePlatformStore.getState();
    const openingTask = store.tasks.find((task) => task.id === 1);

    expect(taskProgress(openingTask)).toBe(57);

    openingTask.steps
      .filter((step) => !step.done)
      .forEach((step) => usePlatformStore.getState().toggleTaskStep(openingTask.id, step.id));

    const completedTask = usePlatformStore.getState().tasks.find((task) => task.id === 1);
    expect(taskProgress(completedTask)).toBe(100);
    expect(completedTask.done).toBe(true);
  });

  test('creates persistent support and shift requests with references', () => {
    const supportTicket = usePlatformStore.getState().createSupportTicket({
      category: 'schedule',
      message: 'Не отображается смена',
    });
    const shiftRequest = usePlatformStore.getState().createShiftRequest({
      type: 'swap',
      shiftId: 12,
    });

    expect(supportTicket.id).toMatch(/^BH-S-/);
    expect(shiftRequest.id).toMatch(/^BH-SH-/);
    expect(usePlatformStore.getState().supportTickets).toHaveLength(1);
    expect(usePlatformStore.getState().shiftRequests).toHaveLength(1);
    expect(localStorage.getItem('bahandi_staff_platform')).toContain(supportTicket.id);
  });

  test('updates employee contact details', () => {
    usePlatformStore.getState().updateContactDetails({
      phone: '+7 700 111 22 33',
      email: 'test@bahandi.kz',
    });

    expect(usePlatformStore.getState().contactDetails).toEqual({
      phone: '+7 700 111 22 33',
      email: 'test@bahandi.kz',
    });
  });

  test('persists learning progress without duplicating completed modules', () => {
    const store = usePlatformStore.getState();
    store.completeLearningModule('service-standards', 'welcome');
    usePlatformStore.getState().completeLearningModule('service-standards', 'welcome');

    expect(usePlatformStore.getState().learningProgress['service-standards'].completedModuleIds).toEqual(['welcome']);

    usePlatformStore.getState().completeLearningAssessment('service-standards', 100);
    expect(usePlatformStore.getState().learningProgress['service-standards'].assessmentPassed).toBe(true);
  });

  test('creates document and leave requests and allows pending leave cancellation', () => {
    const documentRequest = usePlatformStore.getState().createDocumentRequest({
      documentId: 'employment',
      title: 'Справка с места работы',
    });
    const leaveRequest = usePlatformStore.getState().createLeaveRequest({
      type: 'annual',
      typeLabel: 'Ежегодный оплачиваемый отпуск',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      days: 3,
    });

    expect(documentRequest.id).toMatch(/^BH-D-/);
    expect(leaveRequest.id).toMatch(/^BH-L-/);
    usePlatformStore.getState().cancelLeaveRequest(leaveRequest.id);
    expect(usePlatformStore.getState().leaveRequests.find((item) => item.id === leaveRequest.id).status).toBe('cancelled');
  });
});
