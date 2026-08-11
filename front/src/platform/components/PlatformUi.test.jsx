import { render, screen } from '@testing-library/react';
import { PlatformButton, PlatformCard, PlatformField } from './PlatformUi';

describe('platform UI primitives', () => {
  test('uses explicit visual variants without conflicting surface classes', () => {
    render(<PlatformCard variant="brand">Смена</PlatformCard>);
    const card = screen.getByText('Смена');

    expect(card).toHaveClass('bg-brand');
    expect(card).not.toHaveClass('bg-surface');
  });

  test('disables a loading button', () => {
    render(<PlatformButton loading>Отправить</PlatformButton>);
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  });

  test('connects field errors to the input for assistive technology', () => {
    render(<PlatformField label="Комментарий" error="Поле обязательно" />);

    const input = screen.getByLabelText('Комментарий');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Поле обязательно');
  });
});
