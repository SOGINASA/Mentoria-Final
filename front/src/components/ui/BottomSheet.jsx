// Модалка-шит: затемнение + всплытие снизу. На десктопе центрируется.
export default function BottomSheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center animate-fadeIn"
      style={{ background: 'rgba(10,12,8,.55)', backdropFilter: 'blur(3px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-surface p-6 pt-5 animate-slideUp rounded-t-3xl md:rounded-3xl"
        style={{ boxShadow: '0 -10px 40px rgba(0,0,0,.3)' }}
      >
        <div className="w-9 h-1 rounded mx-auto mb-4 md:hidden" style={{ background: 'var(--line)' }} />
        {children}
      </div>
    </div>
  );
}
