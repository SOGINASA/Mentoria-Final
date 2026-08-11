import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../components/ui/Icon';

export default function PlatformModal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousActive = document.activeElement;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector('button, input, textarea, select, [tabindex]:not([tabindex="-1"])')?.focus();
    }, 20);

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl' };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5" role="presentation">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 cursor-default bg-black/50 animate-fadeIn"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-dialog-title"
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-card animate-slideUp sm:rounded-[28px] sm:animate-fadeUp ${widths[size] || widths.md}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <header className="flex items-start gap-4 border-b border-line2 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <h2 id="platform-dialog-title" className="m-0 font-head text-[22px] font-semibold leading-tight text-text sm:text-[25px]">{title}</h2>
            {subtitle && <p className="mb-0 mt-1.5 text-[12px] leading-relaxed text-muted sm:text-[13px]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-2xl bg-surface2 text-muted transition-colors hover:text-text active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            aria-label="Закрыть"
          >
            <Icon name="close" size={19} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-col-reverse gap-2 border-t border-line2 bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
