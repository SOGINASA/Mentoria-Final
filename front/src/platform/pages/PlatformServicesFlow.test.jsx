import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePlatformStore } from '../../store/platformStore';
import PlatformCoursePage from './PlatformCoursePage';
import PlatformDocumentsPage from './PlatformDocumentsPage';
import PlatformLeavePage from './PlatformLeavePage';
import PlatformLearningPage from './PlatformLearningPage';
import PlatformServicesPage from './PlatformServicesPage';
import * as employeeServicesApi from '../../api/employeeServices.api';

jest.mock('../../api/employeeServices.api');

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useParams: () => ({ courseId: 'service-standards' }),
}), { virtual: true });

describe('employee services flows', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlatformStore.getState().resetPlatformState();
    employeeServicesApi.completeModule.mockResolvedValue({ progress: {
      course_id: 'service-standards', completed_module_ids: ['welcome'],
      assessment_passed: false,
    } });
    employeeServicesApi.createDocumentRequest.mockResolvedValue({ request: {
      request_id: 1, reference: 'BH-D-000001', document_id: 'employment',
      title: 'Справка с места работы', status: 'processing', version: 1,
      created_at: '2026-08-12T00:00:00Z',
    } });
    employeeServicesApi.createLeaveRequest.mockResolvedValue({ request: {
      request_id: 2, reference: 'BH-L-000002', leave_type: 'annual',
      starts_on: '2099-10-01', ends_on: '2099-10-03', days: 3,
      status: 'pending', version: 1, created_at: '2026-08-12T00:00:00Z',
    }, leave_balance: { available_days: 21, preliminary: true } });
    usePlatformStore.setState({ leaveBalance: { available_days: 24, preliminary: true } });
  });

  test('service hub and learning catalog render from a clean store', () => {
    const { unmount } = render(<PlatformServicesPage />);
    expect(screen.getByRole('heading', { name: 'Сервисы сотрудника' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Обучение и допуски/ })).toHaveAttribute('href', '/app/learning');

    unmount();
    render(<PlatformLearningPage />);
    expect(screen.getByRole('heading', { name: 'Стандарты сервиса Bahandi' })).toBeInTheDocument();
  });

  test('completes a course module through the lesson interface', async () => {
    render(<PlatformCoursePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Завершить урок' }));

    await waitFor(() => expect(usePlatformStore.getState().learningProgress['service-standards'].completedModuleIds).toEqual(['welcome']));
    expect(await screen.findByRole('heading', { name: 'Приём и уточнение заказа' })).toBeInTheDocument();
  });

  test('creates a document request from the document dialog', async () => {
    render(<PlatformDocumentsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Запросить Справка с места работы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать документ' }));

    await waitFor(() => expect(usePlatformStore.getState().documentRequests).toHaveLength(1));
    expect(usePlatformStore.getState().documentRequests[0].documentId).toBe('employment');
  });

  test('submits a validated leave request through the form', async () => {
    render(<PlatformLeavePage />);

    fireEvent.change(screen.getByLabelText('Дата начала'), { target: { value: '2099-10-01' } });
    fireEvent.change(screen.getByLabelText('Дата окончания'), { target: { value: '2099-10-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить на согласование' }));

    await waitFor(() => expect(usePlatformStore.getState().leaveRequests).toHaveLength(1));
    const request = usePlatformStore.getState().leaveRequests[0];
    expect(request.status).toBe('pending');
    expect(request.days).toBe(3);
  });
});
