import { fireEvent, render, screen } from '@testing-library/react';
import * as financeApi from '../../api/finance.api';
import PlatformFinancePage from './PlatformFinancePage';

jest.mock('../../api/finance.api');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

const WORKSPACE = {
  period: '2026-08', payroll_connected: false,
  stores: [{ id: 1, name: 'Bahandi Абая' }],
  employees: [{ id: 4, full_name: 'Алия Садыкова', role: 'sender', store_id: 1, approved_minutes: 450, pending_minutes: 0, approved_timecards: 1, pending_timecards: 0, rejected_timecards: 0, open_timecards: 0, readiness: 'ready' }],
  analytics: { approved_minutes: 450, pending_minutes: 0, ready_employees: 1, attention_employees: 0, no_data_employees: 0, pending_corrections: 0, readiness_percent: 100, stores: [{ store_id: 1, name: 'Bahandi Абая', employees: 1, approved_minutes: 450, pending_minutes: 0, ready_employees: 1, attention_employees: 0 }] },
};

describe('Finance workspace', () => {
  beforeEach(() => financeApi.getWorkspace.mockResolvedValue(WORKSPACE));
  afterEach(() => jest.clearAllMocks());

  test('shows confirmed hours and employee drill-down', async () => {
    render(<PlatformFinancePage />);
    expect(await screen.findByRole('heading', { name: 'Расчёт рабочего времени' })).toBeInTheDocument();
    expect((await screen.findAllByText('7 ч 30 мин')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Сотрудники' }));
    fireEvent.click(await screen.findByRole('button', { name: /Алия Садыкова/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Готовность к расчёту');
  });
});
