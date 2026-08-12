import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as managerApi from '../../api/manager.api';
import * as writeOffsApi from '../../api/writeOffs.api';
import PlatformReviewerPage from './PlatformReviewerPage';

jest.mock('../../api/manager.api');
jest.mock('../../api/writeOffs.api');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

describe('reviewer workspace', () => {
  beforeEach(() => {
    managerApi.getWorkspace.mockResolvedValue({ stores: [{ id: 1, name: 'Bahandi Абая' }] });
    managerApi.getTodayQueue.mockResolvedValue({ tasks: [{ id: 4 }], timecards: [] });
    writeOffsApi.listWriteOffs.mockResolvedValue({
      write_offs: [{ id: 8, store_id: 1, status: 'pending', created_at: '2026-08-12T08:00:00Z', comment: 'Повреждённая упаковка', photos: [], author: { full_name: 'Алия' }, store: { name: 'Bahandi Абая' } }],
    });
    writeOffsApi.getAnalytics.mockResolvedValue({ totals: { total: 3, pending: 1, approved: 2, rejected: 0 }, with_hold: 1, no_hold: 2, trend: [], by_store: [] });
  });

  afterEach(() => jest.clearAllMocks());

  test('shows the scoped review queue and switches to analytics', async () => {
    render(<PlatformReviewerPage />);

    expect(await screen.findByRole('heading', { name: 'Контроль точек' })).toBeInTheDocument();
    expect(await screen.findByText('Повреждённая упаковка')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));
    expect(screen.getByRole('heading', { name: 'Качество списаний' })).toBeInTheDocument();
    await waitFor(() => expect(writeOffsApi.getAnalytics).toHaveBeenCalledWith({ days: '30' }));
  });
});
