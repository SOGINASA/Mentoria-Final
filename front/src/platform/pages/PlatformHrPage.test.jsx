import { fireEvent, render, screen } from '@testing-library/react';
import * as hrApi from '../../api/hr.api';
import PlatformHrPage from './PlatformHrPage';

jest.mock('../../api/hr.api');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

const WORKSPACE = {
  stores: [{ id: 1, name: 'Bahandi Абая' }],
  employees: [{ id: 5, user_id: 5, employee_id: 12, full_name: 'Алия Садыкова', position: 'Кассир', role: 'sender', store_id: 1, email: 'aliya@example.com', phone: '+77010000000', has_account: true, on_leave: false, learning: { completed_courses: 1, required_completed: 1, required_total: 2, compliance_percent: 50 } }, { id: 'employee-13', user_id: null, employee_id: 13, full_name: 'Сотрудник без аккаунта', position: 'Повар', role: 'employee', store_id: 1, email: null, phone: null, has_account: false, on_leave: false, learning: { completed_courses: 0, required_completed: 0, required_total: 2, compliance_percent: 0 } }],
  requests: { documents: [], leave: [], upcoming_leave: [], open_hr_cases: 1 },
  analytics: { active_employees: 1, on_leave: 0, pending_documents: 0, pending_leave: 0, learning_compliance: 50, stores: [{ store_id: 1, name: 'Bahandi Абая', team: 1, on_leave: 0, learning_compliant: 0 }], courses: [{ course_id: 'service-standards', completed: 1, total: 1, percent: 100, required: true }] },
};

describe('HR workspace', () => {
  beforeEach(() => hrApi.getWorkspace.mockResolvedValue(WORKSPACE));
  afterEach(() => jest.clearAllMocks());

  test('shows workforce data and employee details', async () => {
    render(<PlatformHrPage />);
    expect(await screen.findByRole('heading', { name: 'HR-кабинет' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Сотрудники' }));
    fireEvent.click(await screen.findByRole('button', { name: /Алия Садыкова/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('aliya@example.com');
    fireEvent.click(screen.getAllByRole('button', { name: 'Закрыть' }).at(-1));
    expect(screen.getByRole('button', { name: /Сотрудник без аккаунта/ })).toHaveTextContent('Нет аккаунта');
  });
});
