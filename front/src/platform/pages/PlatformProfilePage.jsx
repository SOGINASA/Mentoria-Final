import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { HOME_ROUTE_BY_ROLE } from '../../constants/roles';
import { initials } from '../../utils/format';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import { DetailRow, IconTile, PageIntro, PlatformButton, PlatformCard, PlatformField, ProgressBar, SectionHeading, StatusPill } from '../components/PlatformUi';

function SettingToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 flex-none cursor-pointer rounded-full transition-colors active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${checked ? 'bg-green' : 'bg-line'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ProfileRow({ icon, tone, title, subtitle, onClick, right }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] w-full cursor-pointer items-center gap-3.5 border-b border-line2 bg-transparent p-4 text-left transition-[background-color,transform] last:border-b-0 hover:bg-surface2 active:scale-[.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green sm:px-5"
    >
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text">{title}</span>
        {subtitle && <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">{subtitle}</span>}
      </span>
      {right || <Icon name="chevronRight" size={18} className="text-faint" />}
    </button>
  );
}

export default function PlatformProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme, lang, setLang, showToast } = useUiStore();
  const { p } = usePlatformCopy();
  const [panel, setPanel] = useState(null);
  const contactDetails = usePlatformStore((state) => state.contactDetails);
  const updateContactDetails = usePlatformStore((state) => state.updateContactDetails);
  const createSupportTicket = usePlatformStore((state) => state.createSupportTicket);
  const [contactDraft, setContactDraft] = useState(contactDetails);
  const [contactErrors, setContactErrors] = useState({});
  const currentYear = new Date().getFullYear();

  const hrItems = [
    { id: 'documents', icon: 'clipboard', tone: 'green', title: p.documents, subtitle: 'Договоры, справки и расчётные документы' },
    { id: 'vacation', icon: 'calendar', tone: 'orange', title: p.vacation, subtitle: 'Баланс дней, заявки и статусы' },
    { id: 'learning', icon: 'book', tone: 'amber', title: p.learning_center, subtitle: 'Курсы, навыки и действующие допуски' },
    { id: 'support', icon: 'helpCircle', tone: 'green', title: p.support, subtitle: 'Вопросы HR, payroll и операционной команде' },
  ];

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function openHrItem(id) {
    if (id === 'support') navigate('/app/support');
    else setPanel(id);
  }

  function saveProfile() {
    const errors = {};
    if (contactDraft.phone.replace(/\D/g, '').length < 11) errors.phone = 'Проверьте номер телефона';
    if (!/^\S+@\S+\.\S+$/.test(contactDraft.email)) errors.email = 'Введите корректный email';
    setContactErrors(errors);
    if (Object.keys(errors).length) return;

    updateContactDetails({
      phone: contactDraft.phone.trim(),
      email: contactDraft.email.trim(),
    });
    setPanel(null);
    showToast('Контактные данные сохранены');
  }

  function requestDocument(title) {
    const ticket = createSupportTicket({
      category: 'hr',
      message: `Запрос документа: ${title}`,
    });
    showToast(`Запрос ${ticket.id} создан`);
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.profile} title={p.profile_title} />

      <PlatformCard className="relative mt-6 overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-green-tint" />
        <div className="relative z-[1] flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-[88px] w-[88px] flex-none place-items-center rounded-[28px] bg-brand font-head text-[31px] font-semibold text-on-brand shadow-card">
            {initials(user?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 truncate font-head text-[27px] font-semibold text-text sm:text-[32px]">{user?.full_name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-green-tint px-3 py-1.5 text-[11px] font-bold text-green">{p.position_value}</span>
              {user?.store?.name && <span className="rounded-full bg-surface2 px-3 py-1.5 text-[11px] font-bold text-muted">{user.store.name}</span>}
            </div>
          </div>
          <button type="button" onClick={() => { setContactDraft(contactDetails); setContactErrors({}); setPanel('edit'); }} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[13px] font-bold text-text transition-colors hover:bg-surface2 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
            <Icon name="edit" size={18} />
            Редактировать
          </button>
        </div>

        <div className="relative z-[1] mt-6 grid gap-3 sm:grid-cols-3">
          {[
            [p.employee_id, user?.employee_id ? `BH-${String(user.employee_id).padStart(5, '0')}` : 'BH-00241'],
            [p.position, p.position_value],
            [p.company_since, p.company_since_value],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface2 p-4">
              <div className="text-[11px] font-medium text-muted">{label}</div>
              <div className="mt-1.5 text-[14px] font-semibold text-text">{value}</div>
            </div>
          ))}
        </div>
      </PlatformCard>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading title={p.hr_services} />
          <PlatformCard className="overflow-hidden">
            {hrItems.map((item) => (
              <ProfileRow key={item.title} {...item} onClick={() => openHrItem(item.id)} />
            ))}
          </PlatformCard>
        </section>

        <section>
          <SectionHeading title={p.settings} />
          <PlatformCard className="overflow-hidden">
            <div className="flex min-h-[76px] items-center gap-3.5 border-b border-line2 p-4 sm:px-5">
              <IconTile icon="globe" tone="green" size="sm" />
              <div className="min-w-0 flex-1 text-[14px] font-semibold text-text">{p.language}</div>
              <div className="inline-flex rounded-xl bg-surface2 p-1" role="group" aria-label={p.language}>
                {['ru', 'kz'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLang(value)}
                    aria-pressed={lang === value}
                    className={`min-h-9 rounded-lg px-3 text-[11px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${lang === value ? 'bg-brand text-on-brand' : 'text-muted hover:bg-surface'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex min-h-[76px] items-center gap-3.5 border-b border-line2 p-4 sm:px-5">
              <IconTile icon={theme === 'dark' ? 'moon' : 'sun'} tone="orange" size="sm" />
              <div className="min-w-0 flex-1 text-[14px] font-semibold text-text">{p.theme}</div>
              <SettingToggle checked={theme === 'dark'} onChange={toggleTheme} label={p.theme} />
            </div>
            <ProfileRow
              icon="arrowSwap"
              tone="amber"
              title={p.old_system}
              subtitle={p.old_system_sub}
              onClick={() => navigate(HOME_ROUTE_BY_ROLE[user?.role] || '/')}
            />
          </PlatformCard>

          <button
            type="button"
            onClick={() => setPanel('logout')}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red bg-red-tint px-4 text-[13px] font-bold text-red transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            <Icon name="logout" size={19} />
            {p.logout}
          </button>
        </section>
      </div>

      <PlatformModal open={panel === 'edit'} onClose={() => setPanel(null)} title="Контактные данные" subtitle="Основные данные сотрудника меняются только через HR" footer={<><PlatformButton variant="secondary" onClick={() => setPanel(null)}>Отмена</PlatformButton><PlatformButton icon="check" onClick={saveProfile}>Сохранить</PlatformButton></>}>
        <div className="space-y-4">
          <PlatformField label="Телефон" type="tel" value={contactDraft.phone} error={contactErrors.phone} onChange={(event) => { setContactDraft((draft) => ({ ...draft, phone: event.target.value })); setContactErrors((errors) => ({ ...errors, phone: null })); }} autoComplete="tel" />
          <PlatformField label="Рабочая почта" type="email" value={contactDraft.email} error={contactErrors.email} onChange={(event) => { setContactDraft((draft) => ({ ...draft, email: event.target.value })); setContactErrors((errors) => ({ ...errors, email: null })); }} autoComplete="email" />
        </div>
        <div className="mt-4 rounded-2xl bg-surface2 p-4 text-[12px] leading-relaxed text-muted">ФИО, должность и торговая точка синхронизируются с кадровой системой.</div>
      </PlatformModal>

      <PlatformModal open={panel === 'documents'} onClose={() => setPanel(null)} title={p.documents} subtitle="Актуальные документы сотрудника" size="lg" footer={<PlatformButton variant="secondary" onClick={() => setPanel(null)}>Закрыть</PlatformButton>}>
        <div className="space-y-2">
          {[
            ['Трудовой договор', 'PDF • обновлён 12.06.2025'],
            [`Расчётный лист • ${currentYear}`, 'PDF • 184 КБ'],
            ['Справка с места работы', 'Формируется по запросу'],
          ].map(([title, meta]) => (
            <div key={title} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-line p-3.5">
              <IconTile icon="fileText" tone="green" size="sm" />
              <div className="min-w-0 flex-1"><div className="text-[13px] font-bold text-text">{title}</div><div className="mt-1 text-[11px] text-muted">{meta}</div></div>
              <button type="button" onClick={() => requestDocument(title)} className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl bg-surface2 text-green hover:bg-green-tint active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label={`Запросить ${title}`}><Icon name="send" size={19} /></button>
            </div>
          ))}
        </div>
      </PlatformModal>

      <PlatformModal open={panel === 'vacation'} onClose={() => setPanel(null)} title={p.vacation} subtitle="Баланс и ближайшие заявки" footer={<><PlatformButton variant="secondary" onClick={() => setPanel(null)}>Закрыть</PlatformButton><PlatformButton icon="plus" onClick={() => { setPanel(null); showToast('Черновик заявки создан'); }}>Новая заявка</PlatformButton></>}>
        <div className="rounded-2xl bg-orange-tint p-5"><div className="text-[11px] font-bold uppercase tracking-[.1em] text-orange">Доступно</div><div className="mt-2 font-head text-[36px] font-semibold text-orange">12 дней</div><div className="mt-1 text-[12px] text-muted">из 24 дней в {currentYear} году</div></div>
        <div className="mt-5"><DetailRow icon="calendar" label="Запланировано" value="2–8 сентября" /><DetailRow icon="checkCircle" label="Статус заявки" value="Согласовано" /><DetailRow icon="clock" label="Следующее начисление" value="1 сентября" /></div>
      </PlatformModal>

      <PlatformModal open={panel === 'learning'} onClose={() => setPanel(null)} title={p.learning_center} subtitle="Обязательные курсы и развитие" footer={<PlatformButton variant="secondary" onClick={() => setPanel(null)}>Закрыть</PlatformButton>}>
        <div className="rounded-2xl border border-line p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-bold text-text">Стандарты сервиса</div><div className="mt-1 text-[11px] text-muted">4 из 6 уроков</div></div><StatusPill tone="amber">В процессе</StatusPill></div><div className="mt-4"><ProgressBar value={67} /></div><PlatformButton className="mt-4 w-full" icon="play" onClick={() => showToast('Урок открыт')}>Продолжить обучение</PlatformButton></div>
        <div className="mt-3 rounded-2xl border border-line p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-bold text-text">Безопасность на кухне</div><div className="mt-1 text-[11px] text-muted">Допуск действует до июня 2027</div></div><StatusPill>Пройдено</StatusPill></div></div>
      </PlatformModal>

      <PlatformModal open={panel === 'logout'} onClose={() => setPanel(null)} title="Выйти из аккаунта?" subtitle="Для следующего входа снова потребуются данные авторизации" footer={<><PlatformButton variant="secondary" onClick={() => setPanel(null)}>Отмена</PlatformButton><PlatformButton variant="danger" icon="logout" onClick={onLogout}>{p.logout}</PlatformButton></>}>
        <div className="rounded-2xl bg-red-tint p-4 text-[13px] leading-relaxed text-red">Незавершённые локальные действия в новой платформе не сохранятся.</div>
      </PlatformModal>
    </div>
  );
}
