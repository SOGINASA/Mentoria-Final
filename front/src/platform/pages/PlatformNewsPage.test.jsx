import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as newsApi from '../../api/news.api';
import { submitManagerMutation } from '../../offline/managerMutationQueue';
import { useAuthStore } from '../../store/authStore';
import { usePlatformStore } from '../../store/platformStore';
import { useUiStore } from '../../store/uiStore';
import PlatformNewsPage from './PlatformNewsPage';

jest.mock('../../api/news.api');
jest.mock('../../offline/managerMutationQueue');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

describe('HR news publishing', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 7, role: 'hr' } });
    usePlatformStore.setState({
      permissions: ['news.manage'], news: [], markNewsRead: jest.fn(), addNewsPost: jest.fn(),
    });
    useUiStore.setState({ showToast: jest.fn() });
    newsApi.getManageContext.mockResolvedValue({ stores: [{ id: 3, name: 'Bahandi Абая' }] });
    submitManagerMutation.mockResolvedValue({
      post: { id: 11, title: 'Кадровая новость', body: 'Текст новости', published_at: '2026-08-12T10:00:00Z' },
    });
  });

  afterEach(() => jest.clearAllMocks());

  test('loads scoped stores without manager workspace and adds a published post to the feed', async () => {
    render(<PlatformNewsPage />);

    await waitFor(() => expect(newsApi.getManageContext).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Заголовок'), { target: { value: 'Кадровая новость' } });
    fireEvent.change(within(dialog).getByLabelText('Текст новости'), { target: { value: 'Текст новости' } });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Опубликовать' }).at(-1));

    await waitFor(() => expect(submitManagerMutation).toHaveBeenCalledWith(
      'news.create',
      { body: expect.objectContaining({
        title: 'Кадровая новость', body: 'Текст новости', store_id: 3, status: 'published',
      }) },
      7,
    ));
    expect(usePlatformStore.getState().addNewsPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11 }),
    );
  });
});
