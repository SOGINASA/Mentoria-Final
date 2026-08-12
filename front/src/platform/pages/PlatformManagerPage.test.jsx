import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as managerApi from '../../api/manager.api';
import { useAuthStore } from '../../store/authStore';
import PlatformManagerPage from './PlatformManagerPage';

jest.mock('../../api/manager.api');

const WORKSPACE = {
  stores: [{ id: 1, name: 'Bahandi Абая' }],
  team: [{ id: 7, full_name: 'Алия Садыкова', role: 'sender', store_id: 1 }],
  shifts: [],
  tasks: [],
};

describe('manager workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: { id: 55, role: 'manager' }, status: 'authed' });
    managerApi.getWorkspace.mockResolvedValue(WORKSPACE);
    managerApi.createTask.mockResolvedValue({ task: { id: 11 } });
  });

  afterEach(() => jest.clearAllMocks());

  test('renders scoped team and creates an assigned task', async () => {
    render(<PlatformManagerPage />);

    expect(await screen.findByRole('heading', { name: 'Управление точкой' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Поставить задачу' }));
    fireEvent.change(screen.getByLabelText('Название задачи'), { target: { value: 'Проверить открытие точки' } });
    fireEvent.change(screen.getByLabelText('Исполнитель'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать задачу' }));

    await waitFor(() => expect(managerApi.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Проверить открытие точки', store_id: 1, assignee_id: 7,
    }), expect.any(String)));
  });

  test('requires confirmation and reason before cancelling a shift', async () => {
    managerApi.getWorkspace.mockResolvedValue({
      ...WORKSPACE,
      shifts: [{ id: 9, version: 2, title: 'Вечерняя смена', store_id: 1, status: 'published', starts_at: '2027-01-10T12:00:00Z', ends_at: '2027-01-10T20:00:00Z', headcount: 1, assignments: [] }],
    });
    managerApi.cancelShift.mockResolvedValue({ shift: { id: 9, status: 'cancelled' } });
    render(<PlatformManagerPage />);

    await screen.findByRole('heading', { name: 'Управление точкой' });
    fireEvent.click(screen.getByRole('tab', { name: 'Смены' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить смену' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Причина отмены'), { target: { value: 'Точка закрыта на обслуживание' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить смену' }));

    await waitFor(() => expect(managerApi.cancelShift).toHaveBeenCalledWith(9, {
      version: 2, reason: 'Точка закрыта на обслуживание',
    }, expect.any(String)));
  });
});
