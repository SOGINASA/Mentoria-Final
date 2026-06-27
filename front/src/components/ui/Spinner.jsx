export default function Spinner({ size = 22, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        border: '2.5px solid var(--line)',
        borderTopColor: 'var(--green)',
      }}
      role="status"
      aria-label="loading"
    />
  );
}
