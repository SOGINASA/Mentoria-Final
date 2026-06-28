// Анимированный отпечаток пальца. state: 'scanning' | 'success' | 'error'
// Гребни отпечатка — набор путей (Lucide fingerprint).
const RIDGES = [
  'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
  'M14 13.12c0 2.38 0 6.38-1 8.88',
  'M17.29 21.02c.12-.6.43-2.3.5-3.02',
  'M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4',
  'M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2',
  'M8.65 22c.21-.66.45-1.32.57-2',
  'M9 6.8a6 6 0 0 1 9 5.2v2',
  'M21.8 16c.2-2 .131-5.354 0-6',
];

export default function Fingerprint({ size = 132, state = 'scanning' }) {
  const color = state === 'success' ? 'var(--green)' : state === 'error' ? 'var(--red)' : 'var(--green)';
  const ringBg = state === 'error' ? 'var(--red-tint)' : 'var(--green-tint)';

  return (
    <div className={`bio-fp ${state === 'success' ? 'is-success' : ''}`} style={{ width: size, height: size, background: ringBg }}>
      {state === 'scanning' && <span className="bio-ring" />}

      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {RIDGES.map((d, i) => (
          <path key={i} d={d} className={state === 'scanning' ? 'bio-ridge' : ''} style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </svg>

      {state === 'scanning' && <span className="bio-scanline" />}

      {state === 'success' && (
        <span className="bio-check bio-pop absolute" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 4 }}>
          <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17l9-10" />
          </svg>
        </span>
      )}
    </div>
  );
}
