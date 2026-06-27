// Горизонтальные фильтр-чипсы (статусы). items: [{ key, label }]
export default function Tabs({ items, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-0.5 px-0.5">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="flex-none px-4 py-2 rounded-full border font-semibold text-[13px] cursor-pointer whitespace-nowrap transition"
            style={{
              background: active ? 'var(--green)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--muted)',
              borderColor: active ? 'var(--green)' : 'var(--line)',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
