import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { usePlatformCopy } from '../platformCopy';
import { IconTile, PageIntro, PlatformButton, PlatformCard, PlatformField, StatusPill } from '../components/PlatformUi';

const categories = [
  { id: 'schedule', label: 'График и смены', icon: 'calendar', tone: 'green' },
  { id: 'payroll', label: 'Зарплата', icon: 'wallet', tone: 'orange' },
  { id: 'hr', label: 'HR и документы', icon: 'briefcase', tone: 'amber' },
  { id: 'tech', label: 'Техническая проблема', icon: 'helpCircle', tone: 'neutral' },
];

export default function PlatformSupportPage() {
  const { p } = usePlatformCopy();
  const showToast = useUiStore((s) => s.showToast);
  const [category, setCategory] = useState('schedule');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (message.trim().length < 10) {
      setError('Опишите вопрос подробнее — минимум 10 символов.');
      return;
    }
    setError('');
    setSent(true);
    showToast('Обращение создано');
  }

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 lg:px-8">
        <PlatformCard className="p-6 text-center sm:p-10">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-green-tint text-green"><Icon name="checkCircle" size={38} /></span>
          <h2 className="mb-2 mt-5 font-head text-[28px] font-semibold text-text">Обращение отправлено</h2>
          <p className="mx-auto mb-0 max-w-md text-[13px] leading-relaxed text-muted">Номер обращения BH-S-1042. Ответ появится в уведомлениях, обычно в течение рабочего дня.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <PlatformButton variant="secondary" onClick={() => { setSent(false); setMessage(''); }}>Создать ещё</PlatformButton>
            <PlatformButton onClick={() => window.history.back()}>Вернуться назад</PlatformButton>
          </div>
        </PlatformCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.support} title="Помощь и обращения" subtitle="Выберите тему — вопрос сразу попадёт нужной команде" />
      <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PlatformCard className="p-5 sm:p-6">
          <fieldset>
            <legend className="text-[13px] font-bold text-text">Тема обращения</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {categories.map((item) => (
                <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,transform] active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${category === item.id ? 'border-green bg-green-tint' : 'border-line bg-surface hover:bg-surface2'}`}>
                  <IconTile icon={item.icon} tone={item.tone} size="sm" />
                  <span className={`text-[13px] font-bold ${category === item.id ? 'text-green' : 'text-text'}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5">
            <PlatformField as="textarea" label="Опишите ситуацию" rows={6} value={message} onChange={(event) => { setMessage(event.target.value); if (error) setError(''); }} placeholder="Например: не вижу смену на 14 августа…" hint={`${message.length}/500 символов`} error={error} maxLength={500} />
          </div>
          <div className="mt-4 rounded-2xl bg-surface2 p-4 text-[12px] leading-relaxed text-muted">
            Не указывайте пароль и банковские реквизиты. Данные профиля и торговой точки прикрепятся автоматически.
          </div>
          <PlatformButton className="mt-5 w-full sm:w-auto" icon="send" type="submit">Отправить обращение</PlatformButton>
        </PlatformCard>

        <aside className="space-y-4">
          <PlatformCard className="p-5">
            <div className="flex items-center justify-between gap-3"><IconTile icon="clock" tone="green" /><StatusPill>На связи</StatusPill></div>
            <div className="mt-4 font-head text-[20px] font-semibold text-text">Ответим в рабочее время</div>
            <p className="mb-0 mt-2 text-[12px] leading-relaxed text-muted">Пн–Пт, 09:00–18:00. Срочные вопросы по смене сразу увидит менеджер точки.</p>
          </PlatformCard>
          <a href="tel:+77273105555" className="flex min-h-16 cursor-pointer items-center gap-3 rounded-[22px] border border-line bg-surface p-4 text-text no-underline shadow-card-sm transition-colors hover:border-green hover:bg-green-tint">
            <IconTile icon="phone" tone="orange" size="sm" />
            <span className="min-w-0 flex-1"><span className="block text-[12px] text-muted">Горячая линия</span><span className="mt-1 block font-semibold tabular-nums">+7 727 310 55 55</span></span>
            <Icon name="chevronRight" size={18} className="text-faint" />
          </a>
        </aside>
      </form>
    </div>
  );
}
