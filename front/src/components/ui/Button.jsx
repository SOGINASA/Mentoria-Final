import Spinner from './Spinner';

// Базовая кнопка с вариантами. variant: primary | secondary | danger
const VARIANTS = {
  primary: 'bg-green text-white border-none hover:brightness-110',
  secondary: 'bg-surface text-text border border-line hover:bg-surface2',
  danger: 'border text-red',
};

export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      disabled={isDisabled}
      className={`h-12 px-5 rounded-2xl font-head font-semibold text-base tracking-wide cursor-pointer
        inline-flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${className}`}
      style={variant === 'danger' ? { borderColor: 'var(--red)', background: 'var(--red-tint)' } : undefined}
      {...props}
    >
      {loading ? <Spinner size={20} /> : children}
    </button>
  );
}
