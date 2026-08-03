import Icon from './Icon';

// Компактная кнопка голосового ввода рядом с полем.
// active — это поле сейчас диктуют; listening — микрофон реально слушает.
export default function MicButton({ active, listening, supported = true, onClick, title }) {
  if (!supported) return null;
  const on = active && listening;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className="relative w-9 h-9 flex-none rounded-full grid place-items-center cursor-pointer transition-colors"
      style={{
        background: on ? 'var(--red)' : 'var(--green-tint)',
        color: on ? '#fff' : 'var(--green)',
      }}
    >
      {on && (
        <span
          className="absolute inset-0 rounded-full animate-micPulse"
          style={{ background: 'var(--red)' }}
        />
      )}
      <span className="relative z-[1] grid place-items-center">
        <Icon name={on ? 'stop' : 'mic'} size={on ? 15 : 17} strokeWidth={on ? 2.4 : 2} />
      </span>
    </button>
  );
}

// Живой индикатор «слушаю…» с анимированным эквалайзером.
export function ListeningBar({ label }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 animate-fadeIn"
      style={{ background: 'var(--red-tint)', color: 'var(--red)' }}
    >
      <span className="flex items-end gap-[3px] h-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[3px] h-4 rounded-full bg-current animate-eq origin-bottom"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-[12.5px] font-semibold">{label}</span>
    </div>
  );
}
