// Логотип BAHANDI — зелёный бокс с оранжевыми боковыми полосами.
const SIZES = {
  sm: { h: 26, bar: 5, font: 14, pad: '0 7px', radius: 5, border: 2 },
  md: { h: 36, bar: 7, font: 19, pad: '0 11px', radius: 7, border: 2.5 },
  lg: { h: 54, bar: 11, font: 30, pad: '0 16px', radius: 9, border: 3 },
};

export default function Logo({ size = 'md', className = '' }) {
  const s = SIZES[size] || SIZES.md;
  return (
    <div
      className={`inline-flex items-center overflow-hidden bg-green shadow-card-sm ${className}`}
      style={{ height: s.h, border: `${s.border}px solid var(--ink)`, borderRadius: s.radius }}
    >
      <div style={{ width: s.bar, alignSelf: 'stretch', background: 'var(--orange)' }} />
      <span
        className="font-head font-bold text-white"
        style={{ fontSize: s.font, letterSpacing: '0.6px', padding: s.pad }}
      >
        BAHANDI
      </span>
      <div style={{ width: s.bar, alignSelf: 'stretch', background: 'var(--orange)' }} />
    </div>
  );
}
