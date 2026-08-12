import * as managerApi from '../api/manager.api';
import {
  flushManagerMutations,
  getManagerQueueSnapshot,
  submitManagerMutation,
} from './managerMutationQueue';

jest.mock('../api/manager.api');

describe('manager offline mutation queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  test('persists an offline action and replays it after reconnect', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    const queued = await submitManagerMutation('task.create', {
      body: { store_id: 1, title: 'Проверить кассу' },
    }, 55);

    expect(queued.queued).toBe(true);
    expect(managerApi.createTask).not.toHaveBeenCalled();
    expect(getManagerQueueSnapshot(55).pending).toBe(1);

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    managerApi.createTask.mockResolvedValue({ task: { id: 9 } });
    await flushManagerMutations(55);

    expect(managerApi.createTask).toHaveBeenCalledWith(
      { store_id: 1, title: 'Проверить кассу' }, expect.any(String),
    );
    expect(getManagerQueueSnapshot(55).pending).toBe(0);
  });

  test('replays a create-shift workflow with stable per-step idempotency keys', async () => {
    managerApi.createShift.mockResolvedValue({ shift: { id: 41 } });
    managerApi.assignShift.mockResolvedValue({ assignment: { id: 1 } });
    managerApi.publishShift.mockResolvedValue({ shift: { id: 41 } });

    await submitManagerMutation('shift.create', {
      shift: { store_id: 1, title: 'Утренняя смена' },
      assigneeIds: [7], publish: true,
    }, 55);

    const createKey = managerApi.createShift.mock.calls[0][1];
    const assignKey = managerApi.assignShift.mock.calls[0][2];
    const publishKey = managerApi.publishShift.mock.calls[0][1];
    expect(new Set([createKey, assignKey, publishKey]).size).toBe(3);
    expect(managerApi.assignShift).toHaveBeenCalledWith(41, 7, assignKey);
    expect(getManagerQueueSnapshot(55).items).toHaveLength(0);
  });
});
