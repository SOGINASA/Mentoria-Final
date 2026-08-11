import { taskProgress, usePlatformStore } from './platformStore';
import * as platformApi from '../api/platform.api';
import * as shiftsApi from '../api/shifts.api';
import * as timeApi from '../api/time.api';
import * as tasksApi from '../api/tasks.api';
import * as casesApi from '../api/cases.api';
import * as newsApi from '../api/news.api';

jest.mock('../api/platform.api');
jest.mock('../api/shifts.api');
jest.mock('../api/time.api');
jest.mock('../api/tasks.api');
jest.mock('../api/cases.api');
jest.mock('../api/news.api');

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
});
