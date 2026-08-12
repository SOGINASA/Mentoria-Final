import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as casesApi from '../../api/cases.api';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { submitManagerMutation } from '../../offline/managerMutationQueue';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { usePlatformCopy } from '../platformCopy';
import { SUPPORT_CATEGORIES } from '../platformData';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, PlatformCard, PlatformField, StatusPill } from '../components/PlatformUi';

export default function PlatformSupportPage() {
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  const showToast = useUiStore((s) => s.showToast);
  const createSupportTicket = usePlatformStore((state) => state.createSupportTicket);
  const permissions = usePlatformStore((state) => state.permissions);
  const storedTickets = usePlatformStore((state) => state.supportTickets);
  const user = useAuthStore((state) => state.user);
  const canManage = permissions.includes('cases.manage');
  const [mode, setMode] = useState(canManage ? 'inbox' : 'create');
  const [tickets, setTickets] = useState(storedTickets);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [caseStatus, setCaseStatus] = useState('open');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('schedule');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sentTicket, setSentTicket] = useState(null);

  useEffect(() => {
    if (!canManage || mode !== 'inbox') return;
    let active = true;
    setLoading(true);
    casesApi.list().then((result) => { if (active) setTickets(result.cases || []); })
      .catch((requestError) => showToast(requestError.message || 'Не удалось загрузить обращения'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManage, mode, showToast]);

  function openTicket(ticket) {
    setSelectedTicket(ticket);
    setCaseStatus(ticket.status);
    setReply('');
    setError('');
  }

  async function processTicket(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await submitManagerMutation('case.process', {
        caseId: selectedTicket.id,
        current: selectedTicket,
        reply: reply.trim(),
        status: caseStatus,
      }, user?.id);
      if (!result.queued) {
        const updated = result.case;
        setTickets((items) => items.map((item) => item.id === updated.id ? updated : item));
        setSelectedTicket(updated);
      } else {
        setSelectedTicket(null);
      }
      setReply('');
      showToast(result.queued ? 'Нет сети: ответ сохранён в очереди' : 'Обращение обновлено');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обработать обращение');
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (message.trim().length < 10) {
      setError('Опишите вопрос подробнее — минимум 10 символов.');
      return;
    }
    setError('');
    try {
      const ticket = await createSupportTicket({ category, message: message.trim() });
      setSentTicket(ticket);
      showToast('Обращение создано');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (sentTicket) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 lg:px-8">
        <PlatformCard className="p-6 text-center sm:p-10">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-green-tint text-green"><Icon name="checkCircle" size={38} /></span>
          <h2 className="mb-2 mt-5 font-head text-[28px] font-semibold text-text">Обращение отправлено</h2>
          <p className="mx-auto mb-0 max-w-md text-[13px] leading-relaxed text-muted">Номер обращения {sentTicket.id}. Ответ появится в уведомлениях, обычно в течение рабочего дня.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <PlatformButton variant="secondary" onClick={() => { setSentTicket(null); setMessage(''); }}>Создать ещё</PlatformButton>
            <PlatformButton onClick={() => navigate(-1)}>Вернуться назад</PlatformButton>
          </div>
        </PlatformCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.support} title={canManage && mode === 'inbox' ? 'Обращения команды' : 'Помощь и обращения'} subtitle={canManage && mode === 'inbox' ? 'Отвечайте сотрудникам и контролируйте решение вопросов' : 'Выберите тему — вопрос сразу попадёт нужной команде'} />
      {canManage && <div className="mt-5 inline-grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1"><button type="button" onClick={() => setMode('inbox')} className={`min-h-11 rounded-xl px-4 text-[12px] font-bold ${mode === 'inbox' ? 'bg-brand text-on-brand' : 'text-muted'}`}>Входящие</button><button type="button" onClick={() => setMode('create')} className={`min-h-11 rounded-xl px-4 text-[12px] font-bold ${mode === 'create' ? 'bg-brand text-on-brand' : 'text-muted'}`}>Моё обращение</button></div>}
      {canManage && mode === 'inbox' ? <ManagerCases tickets={tickets} loading={loading} onOpen={openTicket} /> :
      <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PlatformCard className="p-5 sm:p-6">
          <fieldset>
            <legend className="text-[13px] font-bold text-text">Тема обращения</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUPPORT_CATEGORIES.map((item) => (
                <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,transform] active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${category === item.id ? 'border-green bg-green-tint' : 'border-line bg-surface hover:bg-surface2'}`}>
                  <IconTile icon={item.icon} tone={item.tone} size="sm" />
                  <span className={`text-[13px] font-bold ${category === item.id ? 'text-green' : 'text-text'}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5">
            <PlatformField as="textarea" label="Опишите ситуацию" rows={6} value={message} onChange={(event) => { setMessage(event.target.value); if (error) setError(''); }} placeholder="Например: не вижу смену на нужную дату…" hint={`${message.length}/500 символов`} error={error} maxLength={500} />
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
      </form>}

      <PlatformModal open={Boolean(selectedTicket)} onClose={() => !loading && setSelectedTicket(null)} title={selectedTicket?.subject || 'Обращение'} subtitle={`${selectedTicket?.reference || ''} · ${selectedTicket?.author_name || `Сотрудник #${selectedTicket?.author_id || ''}`}`} size="lg" footer={<><PlatformButton variant="secondary" disabled={loading} onClick={() => setSelectedTicket(null)}>Закрыть</PlatformButton><PlatformButton loading={loading} icon="send" onClick={processTicket}>Сохранить и ответить</PlatformButton></>}>
        {selectedTicket && <form onSubmit={processTicket} className="space-y-4"><div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-surface2 p-3">{selectedTicket.messages?.map((item) => <div key={item.id} className={`max-w-[88%] rounded-2xl p-3 text-[12px] leading-relaxed ${item.author_id === user?.id ? 'ml-auto bg-green-tint text-green' : 'bg-surface text-text'}`}><div>{item.body}</div><div className="mt-1 text-[9px] opacity-60">{new Date(item.created_at).toLocaleString('ru-RU')}</div></div>)}</div><PlatformField as="textarea" rows={3} label="Ответ сотруднику" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Напишите ответ или уточняющий вопрос" /><PlatformField as="select" label="Статус обращения" value={caseStatus} onChange={(event) => setCaseStatus(event.target.value)}><option value="open">Новое</option><option value="in_progress">В работе</option><option value="resolved">Решено</option><option value="closed">Закрыто</option></PlatformField>{error && <div role="alert" className="rounded-2xl bg-red-tint p-3 text-[12px] font-semibold text-red">{error}</div>}<button type="submit" className="sr-only">Сохранить</button></form>}
      </PlatformModal>
    </div>
  );
}

function ManagerCases({ tickets, loading, onOpen }) {
  const statuses = { open: ['Новое', 'orange'], in_progress: ['В работе', 'amber'], resolved: ['Решено', 'green'], closed: ['Закрыто', 'neutral'] };
  if (loading && !tickets.length) return <div className="grid min-h-64 place-items-center"><Spinner size={28} /></div>;
  return <div className="mt-6 grid gap-3">{tickets.map((ticket) => { const status = statuses[ticket.status] || [ticket.status, 'neutral']; return <button key={ticket.id} type="button" onClick={() => onOpen(ticket)} className="flex min-h-20 w-full items-center gap-3 rounded-[22px] border border-line bg-surface p-4 text-left shadow-card-sm transition-colors hover:border-green hover:bg-surface2"><IconTile icon="helpCircle" tone={status[1]} size="sm" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-[13px] font-bold text-text">{ticket.subject}</span><StatusPill tone={status[1]}>{status[0]}</StatusPill></span><span className="mt-1 block text-[10px] text-muted">{ticket.author_name || `Сотрудник #${ticket.author_id}`} · {ticket.reference}</span></span><Icon name="chevronRight" size={18} className="text-faint" /></button>; })}{!tickets.length && <PlatformCard className="p-8 text-center"><Icon name="checkCircle" size={32} className="mx-auto text-green" /><div className="mt-3 font-bold text-text">Новых обращений нет</div><div className="mt-1 text-[11px] text-muted">Все вопросы команды обработаны.</div></PlatformCard>}</div>;
}
