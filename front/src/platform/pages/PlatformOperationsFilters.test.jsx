import { render, screen } from '@testing-library/react';
import * as casesApi from '../../api/cases.api';
import * as managerApi from '../../api/manager.api';
import { useAuthStore } from '../../store/authStore';
import { usePlatformStore } from '../../store/platformStore';
import PlatformApprovalsPage from './PlatformApprovalsPage';
import PlatformSupportPage from './PlatformSupportPage';

jest.mock('../../api/cases.api');
jest.mock('../../api/manager.api');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

describe('Operations deep-link filters', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 50, role: 'operations' }, status: 'authed' });
    usePlatformStore.setState({
      hydrated: true, permissions: ['manager.queue', 'cases.manage'], supportTickets: [],
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.clearAllMocks();
  });

  test('approvals opens the requested queue and store only', async () => {
    window.history.pushState({}, '', '/app/approvals?store_id=1&type=timecards');
    managerApi.getTodayQueue.mockResolvedValue({
      timecards: [
        { id: 1, user_id: 11, store_id: 1, worked_minutes: 60, clock_in_at: '2026-08-12T08:00:00Z', version: 1 },
        { id: 2, user_id: 22, store_id: 2, worked_minutes: 120, clock_in_at: '2026-08-12T08:00:00Z', version: 1 },
      ],
    });

    render(<PlatformApprovalsPage />);

    expect(await screen.findByText('Сотрудник #11 · Точка #1')).toBeInTheDocument();
    expect(screen.queryByText('Сотрудник #22 · Точка #2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 Табели/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('support inbox shows cases from the requested store only', async () => {
    window.history.pushState({}, '', '/app/support?store_id=1');
    casesApi.list.mockResolvedValue({ cases: [
      { id: 1, reference: 'BH-S-000001', store_id: 1, subject: 'Вопрос первой точки', status: 'open', author_id: 11 },
      { id: 2, reference: 'BH-S-000002', store_id: 2, subject: 'Вопрос второй точки', status: 'open', author_id: 22 },
    ] });

    render(<PlatformSupportPage />);

    expect(await screen.findByText('Вопрос первой точки')).toBeInTheDocument();
    expect(screen.queryByText('Вопрос второй точки')).not.toBeInTheDocument();
  });
});
