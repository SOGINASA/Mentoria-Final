import { fireEvent, render, screen } from '@testing-library/react';
import * as operationsApi from '../../api/operations.api';
import PlatformOperationsPage from './PlatformOperationsPage';

const mockNavigate = jest.fn();
jest.mock('../../api/operations.api');
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });

const WORKSPACE = {
  stores: [{ id: 1, name: 'Bahandi Абая' }],
  store_summaries: [{ store_id: 1, name: 'Bahandi Абая', address: 'Абая 1', team: 8, today_shifts: 2, uncovered_slots: 1, overdue_tasks: 2, submitted_timecards: 1, open_cases: 1, writeoffs: 3, attention_count: 5 }],
  alerts: [{ id: 'coverage-1', kind: 'coverage', store_id: 1, store_name: 'Bahandi Абая', title: 'Не закрыты места в сменах', count: 1, severity: 'critical', action_url: '/app/management' }],
  analytics: { active_stores: 1, active_employees: 8, today_shifts: 2, uncovered_slots: 1, overdue_tasks: 2, submitted_timecards: 1, open_timecards: 0, open_cases: 1, writeoffs: 3, tasks_created: 4, tasks_completed: 2, task_completion_percent: 50 },
  trend: [],
};

describe('Operations workspace', () => {
  beforeEach(() => operationsApi.getWorkspace.mockResolvedValue(WORKSPACE));
  afterEach(() => jest.clearAllMocks());

  test('shows exceptions and routes to the affected store process', async () => {
    render(<PlatformOperationsPage />);
    expect(await screen.findByRole('heading', { name: 'Центр управления сетью' })).toBeInTheDocument();
    const alert = await screen.findByRole('button', { name: /Не закрыты места в сменах/ });
    fireEvent.click(alert);
    expect(mockNavigate).toHaveBeenCalledWith('/app/management?store_id=1');
  });
});
