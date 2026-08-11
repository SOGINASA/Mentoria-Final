import { fireEvent, render, screen } from '@testing-library/react';
import { usePlatformStore } from '../../store/platformStore';
import PlatformCoursePage from './PlatformCoursePage';
import PlatformDocumentsPage from './PlatformDocumentsPage';
import PlatformLeavePage from './PlatformLeavePage';
import PlatformLearningPage from './PlatformLearningPage';
import PlatformServicesPage from './PlatformServicesPage';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useParams: () => ({ courseId: 'service-standards' }),
}), { virtual: true });

describe('employee services flows', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlatformStore.getState().resetPlatformState();
  });

  test('service hub and learning catalog render from a clean store', () => {
    const { unmount } = render(<PlatformServicesPage />);
    expect(screen.getByRole('heading', { name: 'Сервисы сотрудника' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Обучение и допуски/ })).toHaveAttribute('href', '/app/learning');

    unmount();
    render(<PlatformLearningPage />);
    expect(screen.getByRole('heading', { name: 'Стандарты сервиса Bahandi' })).toBeInTheDocument();
  });

  test('completes a course module through the lesson interface', () => {
    render(<PlatformCoursePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Завершить урок' }));

    expect(usePlatformStore.getState().learningProgress['service-standards'].completedModuleIds).toEqual(['welcome']);
    expect(screen.getByRole('heading', { name: 'Приём и уточнение заказа' })).toBeInTheDocument();
  });

  test('creates a document request from the document dialog', () => {
    render(<PlatformDocumentsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Запросить Справка с места работы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать документ' }));

    expect(usePlatformStore.getState().documentRequests).toHaveLength(1);
    expect(usePlatformStore.getState().documentRequests[0].documentId).toBe('employment');
  });

  test('submits a validated leave request through the form', () => {
    render(<PlatformLeavePage />);

    fireEvent.change(screen.getByLabelText('Дата начала'), { target: { value: '2099-10-01' } });
    fireEvent.change(screen.getByLabelText('Дата окончания'), { target: { value: '2099-10-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить на согласование' }));

    const request = usePlatformStore.getState().leaveRequests[0];
    expect(request.status).toBe('pending');
    expect(request.days).toBe(3);
  });
});
