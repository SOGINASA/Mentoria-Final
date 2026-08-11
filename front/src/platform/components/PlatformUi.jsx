import Icon from '../../components/ui/Icon';

export function PageIntro({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-green">{eyebrow}</div>}
        <h2 className="m-0 font-head text-[28px] font-semibold leading-tight text-text sm:text-[34px]">{title}</h2>
        {subtitle && <p className="mb-0 mt-2 text-[14px] leading-relaxed text-muted sm:text-[15px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({ title, action }) {
  return (
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <h3 className="m-0 font-head text-[19px] font-semibold tracking-wide text-text sm:text-[21px]">{title}</h3>
      {action}
    </div>
  );
}

export function IconTile({ icon, tone = 'green', size = 'md' }) {
  const tones = {
    green: 'bg-green-tint text-green',
    orange: 'bg-orange-tint text-orange',
    amber: 'bg-amber-tint text-amber',
    red: 'bg-red-tint text-red',
    neutral: 'bg-surface2 text-muted',
  };
  return (
    <span className={`grid flex-none place-items-center rounded-2xl ${size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'} ${tones[tone] || tones.green}`}>
      <Icon name={icon} size={size === 'sm' ? 19 : 22} strokeWidth={2.1} />
    </span>
  );
}

export function StatusPill({ children, tone = 'green' }) {
  const tones = {
    green: 'bg-green-tint text-green',
    orange: 'bg-orange-tint text-orange',
    amber: 'bg-amber-tint text-amber',
    red: 'bg-red-tint text-red',
    neutral: 'bg-surface2 text-muted',
  };
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-bold ${tones[tone] || tones.green}`}>{children}</span>;
}

export function PlatformCard({ children, className = '', as: Component = 'div', variant = 'surface', ...props }) {
  const variants = {
    surface: 'border-line bg-surface',
    brand: 'border-transparent bg-green text-white',
    orangeTint: 'border-orange bg-orange-tint',
    greenOutline: 'border-green bg-surface',
  };
  return (
    <Component className={`rounded-[22px] border shadow-card-sm transition-[background-color,border-color,box-shadow] duration-200 ${variants[variant] || variants.surface} ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function PlatformButton({ children, variant = 'primary', icon, className = '', ...props }) {
  const variants = {
    primary: 'border-green bg-green text-white hover:bg-green-d',
    secondary: 'border-line bg-surface text-text hover:bg-surface2',
    soft: 'border-transparent bg-green-tint text-green hover:brightness-95',
    danger: 'border-red bg-red-tint text-red hover:brightness-95',
  };
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 text-[13px] font-bold transition-[color,background-color,border-color,transform] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function PlatformField({ label, hint, error, as: Component = 'input', className = '', ...props }) {
  const id = props.id || `field-${String(label).toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-[12px] font-bold text-text">{label}</span>
      <Component
        id={id}
        className={`min-h-12 w-full rounded-2xl border border-line bg-surface2 px-4 py-3 text-[14px] leading-relaxed text-text outline-none transition-colors placeholder:text-faint focus:border-green focus:ring-2 focus:ring-green/20 ${error ? 'border-red' : ''} ${className}`}
        {...props}
      />
      {(error || hint) && <span className={`mt-1.5 block text-[11px] ${error ? 'text-red' : 'text-muted'}`}>{error || hint}</span>}
    </label>
  );
}

export function DetailRow({ label, value, icon }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-line2 py-3 last:border-b-0">
      {icon && <Icon name={icon} size={18} className="flex-none text-faint" />}
      <span className="min-w-0 flex-1 text-[12px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums text-text">{value}</span>
    </div>
  );
}

export function ProgressBar({ value, tone = 'green', label }) {
  const colors = { green: 'bg-green', orange: 'bg-orange', amber: 'bg-amber', red: 'bg-red' };
  return (
    <div>
      {label && <div className="mb-2 flex justify-between gap-3 text-[12px] font-semibold text-muted"><span>{label}</span><span className="tabular-nums text-text">{value}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${colors[tone] || colors.green}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function EmptyPlatformState({ icon = 'clipboard', title, subtitle }) {
  return (
    <PlatformCard className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <IconTile icon={icon} tone="neutral" />
        <h3 className="mb-2 mt-4 font-head text-xl font-semibold text-text">{title}</h3>
        <p className="m-0 max-w-sm text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
    </PlatformCard>
  );
}
