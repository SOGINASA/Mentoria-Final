import Icon from './Icon';

// Пустое состояние списков. tone: neutral | success
export default function EmptyState({ icon = 'list', title, subtitle, tone = 'neutral', action }) {
  const bg = tone === 'success' ? 'var(--gst-tint)' : 'var(--surface2)';
  const fg = tone === 'success' ? 'var(--gst)' : 'var(--faint)';
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-5">
      <div className="w-20 h-20 rounded-full grid place-items-center mb-4" style={{ background: bg, color: fg }}>
        <Icon name={icon} size={36} strokeWidth={1.7} />
      </div>
      <h3 className="font-head font-semibold text-lg text-text m-0 mb-1.5">{title}</h3>
      {subtitle && <p className="text-muted text-[13.5px] m-0 mb-4">{subtitle}</p>}
      {action}
    </div>
  );
}
