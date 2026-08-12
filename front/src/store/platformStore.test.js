import { taskProgress, usePlatformStore } from './platformStore';
import * as platformApi from '../api/platform.api';
import * as shiftsApi from '../api/shifts.api';
import * as timeApi from '../api/time.api';
import * as tasksApi from '../api/tasks.api';
import * as casesApi from '../api/cases.api';
import * as newsApi from '../api/news.api';
import * as employeeServicesApi from '../api/employeeServices.api';

jest.mock('../api/platform.api');
jest.mock('../api/shifts.api');
jest.mock('../api/time.api');
jest.mock('../api/tasks.api');
jest.mock('../api/cases.api');
jest.mock('../api/news.api');
jest.mock('../api/employeeServices.api');

describe('platformStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    usePlatformStore.getState().resetPlatformState();
  });

  test('calculates task progress from server task shape', () => {
    expect(taskProgress({ done: false, steps: [{ done: true }, { done: false }] })).toBe(50);
    expect(taskProgress({ done: true, steps: [] })).toBe(100);
  });

  test('hydrates server data as the authoritative snapshot', async () => {
    platformApi.bootstrap.mockResolvedValue({
      user: { phone: '+7 700', email: 'employee@bahandi.kz' },
      shifts: [{ id: 1 }], tasks: [{ id: 2, done: false }],
      time_tracking: { state: 'clock_in' }, feature_flags: { shifts: true },
      permissions: ['platform.use'],
      employee_services: {
        learning_progress: [], document_requests: [], leave_requests: [],
        leave_balance: { available_days: 24, preliminary: true },
      },
    });
    shiftsApi.listOpen.mockResolvedValue({ shifts: [{ id: 3 }] });
    shiftsApi.listRequests.mockResolvedValue({ requests: [] });
    casesApi.list.mockResolvedValue({ cases: [] });
    newsApi.list.mockResolvedValue({ news: [] });
    timeApi.listTimecards.mockResolvedValue({ timecards: [] });

    await usePlatformStore.getState().hydrate();
    const state = usePlatformStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.shiftActive).toBe(true);
    expect(state.shifts).toEqual([{ id: 1 }]);
    expect(state.openShifts).toEqual([{ id: 3 }]);
  });

  test('does not request APIs for disabled features', async () => {
    platformApi.bootstrap.mockResolvedValue({
      user: {}, shifts: [], tasks: [], time_tracking: { state: 'idle' },
      feature_flags: {
        staff_platform: true, shifts: false, time_tracking: false,
        support_cases: false, news: false, hr_services: false,
      },
      permissions: [], employee_services: {},
    });

    await usePlatformStore.getState().hydrate();

    expect(shiftsApi.listOpen).not.toHaveBeenCalled();
    expect(shiftsApi.listRequests).not.toHaveBeenCalled();
    expect(casesApi.list).not.toHaveBeenCalled();
    expect(newsApi.list).not.toHaveBeenCalled();
    expect(timeApi.listTimecards).not.toHaveBeenCalled();
  });

  test('persists a support case returned by backend', async () => {
    casesApi.create.mockResolvedValue({
      case: { id: 7, reference: 'BH-S-000007', category: 'schedule' },
    });
    const result = await usePlatformStore.getState().createSupportTicket({
      category: 'schedule', message: 'Не отображается смена',
    });
    expect(result.id).toBe('BH-S-000007');
    expect(usePlatformStore.getState().supportTickets[0].reference).toBe('BH-S-000007');
  });

  test('persists learning progress returned by backend', async () => {
    employeeServicesApi.completeModule.mockResolvedValue({
      progress: {
        course_id: 'service-standards', completed_module_ids: ['welcome'],
        assessment_passed: false,
      },
    });
    employeeServicesApi.completeAssessment.mockResolvedValue({
      progress: {
        course_id: 'service-standards', completed_module_ids: ['welcome'],
        assessment_score: 100, assessment_passed: true,
      },
    });
    const store = usePlatformStore.getState();
    await store.completeLearningModule('service-standards', 'welcome');

    expect(usePlatformStore.getState().learningProgress['service-standards'].completedModuleIds).toEqual(['welcome']);

    await usePlatformStore.getState().completeLearningAssessment('service-standards', 'a');
    expect(usePlatformStore.getState().learningProgress['service-standards'].assessmentPassed).toBe(true);
  });

  test('creates document and leave requests and allows pending leave cancellation', async () => {
    employeeServicesApi.createDocumentRequest.mockResolvedValue({ request: {
      request_id: 1, reference: 'BH-D-000001', document_id: 'employment',
      title: 'Справка с места работы', status: 'processing', version: 1,
      created_at: '2026-08-12T00:00:00Z',
    } });
    employeeServicesApi.createLeaveRequest.mockResolvedValue({ request: {
      request_id: 2, reference: 'BH-L-000002', leave_type: 'annual',
      starts_on: '2026-10-01', ends_on: '2026-10-03', days: 3,
      status: 'pending', version: 1, created_at: '2026-08-12T00:00:00Z',
    }, leave_balance: { available_days: 24, preliminary: true } });
    employeeServicesApi.cancelLeaveRequest.mockResolvedValue({ request: {
      request_id: 2, reference: 'BH-L-000002', leave_type: 'annual',
      starts_on: '2026-10-01', ends_on: '2026-10-03', days: 3,
      status: 'cancelled', version: 2, created_at: '2026-08-12T00:00:00Z',
    }, leave_balance: { available_days: 24, preliminary: true } });

    const documentRequest = await usePlatformStore.getState().createDocumentRequest({
      documentId: 'employment',
      title: 'Справка с места работы',
    });
    const leaveRequest = await usePlatformStore.getState().createLeaveRequest({
      type: 'annual',
      typeLabel: 'Ежегодный оплачиваемый отпуск',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      days: 3,
    });

    expect(documentRequest.id).toBe('BH-D-000001');
    expect(leaveRequest.id).toBe('BH-L-000002');
    await usePlatformStore.getState().cancelLeaveRequest(leaveRequest.id);
    expect(usePlatformStore.getState().leaveRequests.find((item) => item.id === leaveRequest.id).status).toBe('cancelled');
  });
});
