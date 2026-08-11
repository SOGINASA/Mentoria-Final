import { fireEvent, render, screen } from '@testing-library/react';
import PlatformModal from './PlatformModal';

describe('PlatformModal', () => {
  test('exposes an accessible dialog and closes on Escape', () => {
    const onClose = jest.fn();

    render(
      <PlatformModal
        open
        onClose={onClose}
        title="Детали смены"
        subtitle="Сегодня, 09:00–18:00"
      >
        <button type="button">Основное действие</button>
      </PlatformModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Детали смены' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders nothing while closed', () => {
    render(
      <PlatformModal open={false} onClose={() => {}} title="Закрыто">
        Содержимое
      </PlatformModal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
