// Static UI taxonomy only. Operational records are loaded from the backend.
export const SUPPORT_CATEGORIES = [
  { id: 'schedule', label: 'График и смены', icon: 'calendar', tone: 'green' },
  { id: 'payroll', label: 'Зарплата', icon: 'wallet', tone: 'orange' },
  { id: 'hr', label: 'HR и документы', icon: 'briefcase', tone: 'amber' },
  { id: 'tech', label: 'Техническая проблема', icon: 'helpCircle', tone: 'neutral' },
];

export const INCOME_BREAKDOWN = [
  { key: 'base_pay', meta: '128 ч × ставка', amount: '143 200 ₸', tone: 'green', icon: 'clock' },
  { key: 'evening_pay', meta: '16 подтверждённых часов', amount: '+9 600 ₸', tone: 'orange', icon: 'moon' },
  { key: 'bonus_pay', meta: 'Качество и выполнение плана', amount: '+8 900 ₸', tone: 'amber', icon: 'checkCircle' },
  { key: 'waiting_pay', meta: '16 часов в табеле', amount: '+24 700 ₸', tone: 'neutral', icon: 'history' },
];

export const EMPLOYEE_SERVICES = [
  {
    id: 'learning',
    title: 'Обучение и допуски',
    subtitle: 'Обязательные курсы, развитие навыков и сертификаты',
    icon: 'book',
    tone: 'amber',
    routeKey: 'learning',
  },
  {
    id: 'documents',
    title: 'Мои документы',
    subtitle: 'Договоры, справки, расчётные листы и запросы',
    icon: 'fileText',
    tone: 'green',
    routeKey: 'documents',
  },
  {
    id: 'leave',
    title: 'Отпуск и отсутствие',
    subtitle: 'Баланс дней, история и согласование новых заявок',
    icon: 'calendar',
    tone: 'orange',
    routeKey: 'leave',
  },
  {
    id: 'support',
    title: 'Помощь и обращения',
    subtitle: 'Связь с HR, payroll и операционной командой',
    icon: 'helpCircle',
    tone: 'neutral',
    routeKey: 'support',
  },
];

export const LEARNING_COURSES = [
  {
    id: 'service-standards',
    title: 'Стандарты сервиса Bahandi',
    description: 'Полный путь гостя: от приветствия до выдачи заказа и обратной связи.',
    category: 'Сервис',
    icon: 'users',
    tone: 'green',
    required: true,
    dueDate: '20 августа',
    modules: [
      { id: 'welcome', title: 'Первый контакт с гостем', duration: '5 мин', body: 'Приветствуйте гостя в течение первых секунд, сохраняйте зрительный контакт и помогайте с выбором без давления.' },
      { id: 'order', title: 'Приём и уточнение заказа', duration: '7 мин', body: 'Повторите состав заказа, уточните важные детали и заранее сообщите реалистичное время ожидания.' },
      { id: 'handoff', title: 'Выдача и завершение визита', duration: '6 мин', body: 'Проверьте комплектность, назовите заказ и убедитесь, что гостю не требуется дополнительная помощь.' },
      { id: 'feedback', title: 'Работа с обратной связью', duration: '8 мин', body: 'Сначала выслушайте гостя, подтвердите, что поняли ситуацию, и предложите понятный следующий шаг.' },
    ],
    assessment: {
      question: 'Что нужно сделать перед завершением выдачи заказа?',
      options: [
        { id: 'a', label: 'Проверить комплектность и убедиться, что гостю ничего не требуется' },
        { id: 'b', label: 'Сразу перейти к следующему заказу' },
        { id: 'c', label: 'Попросить гостя самостоятельно сверить заказ' },
      ],
      correctOptionId: 'a',
    },
  },
  {
    id: 'kitchen-safety',
    title: 'Безопасность на кухне',
    description: 'Температурные режимы, личная безопасность и действия в нештатных ситуациях.',
    category: 'Безопасность',
    icon: 'shieldCheck',
    tone: 'orange',
    required: true,
    validUntil: 'июнь 2027',
    modules: [
      { id: 'temperature', title: 'Температурные режимы', duration: '8 мин', body: 'Сверяйте показатели с технологической картой и сразу фиксируйте отклонения в журнале контроля.' },
      { id: 'equipment', title: 'Работа с оборудованием', duration: '9 мин', body: 'Перед началом смены проверьте исправность оборудования и защитных элементов. Не используйте технику с признаками повреждения.' },
      { id: 'incident', title: 'Действия при инциденте', duration: '6 мин', body: 'Остановите опасную операцию, предупредите коллег и немедленно сообщите менеджеру смены.' },
    ],
    assessment: {
      question: 'Как действовать при признаках неисправности оборудования?',
      options: [
        { id: 'a', label: 'Продолжить работу до конца смены' },
        { id: 'b', label: 'Остановить работу и сообщить менеджеру смены' },
        { id: 'c', label: 'Попытаться отремонтировать оборудование самостоятельно' },
      ],
      correctOptionId: 'b',
    },
  },
  {
    id: 'shift-lead',
    title: 'Основы управления сменой',
    description: 'Распределение ролей, контроль темпа и качественная передача смены.',
    category: 'Развитие',
    icon: 'briefcase',
    tone: 'amber',
    required: false,
    modules: [
      { id: 'briefing', title: 'Брифинг команды', duration: '7 мин', body: 'Обозначьте цель смены, распределите зоны ответственности и убедитесь, что каждый понимает свою роль.' },
      { id: 'peak', title: 'Управление в часы пик', duration: '10 мин', body: 'Следите за узкими местами процесса и перераспределяйте помощь до того, как очередь начнёт расти.' },
      { id: 'handover', title: 'Передача смены', duration: '6 мин', body: 'Зафиксируйте остатки, состояние оборудования и незакрытые вопросы для следующей команды.' },
    ],
    assessment: {
      question: 'Что важно сделать на брифинге перед сменой?',
      options: [
        { id: 'a', label: 'Обозначить цель и распределить зоны ответственности' },
        { id: 'b', label: 'Обсудить только результаты прошлой недели' },
        { id: 'c', label: 'Оставить распределение ролей на усмотрение команды' },
      ],
      correctOptionId: 'a',
    },
  },
];

export const EMPLOYEE_DOCUMENTS = [
  { id: 'contract', title: 'Трудовой договор', category: 'Кадровые', updatedAt: '12 июня 2025', meta: 'PDF • 1,2 МБ', available: true },
  { id: 'payslip', title: 'Расчётный лист • июль 2026', category: 'Начисления', updatedAt: '5 августа 2026', meta: 'PDF • 184 КБ', available: true },
  { id: 'employment', title: 'Справка с места работы', category: 'Справки', updatedAt: 'Формируется по запросу', meta: 'До 1 рабочего дня', available: false },
  { id: 'income', title: 'Справка о доходах', category: 'Справки', updatedAt: 'Формируется по запросу', meta: 'До 3 рабочих дней', available: false },
];

export const LEAVE_TYPES = [
  { id: 'annual', label: 'Ежегодный оплачиваемый отпуск' },
  { id: 'unpaid', label: 'Отпуск без сохранения зарплаты' },
  { id: 'sick', label: 'Больничный' },
  { id: 'other', label: 'Другое отсутствие' },
];
