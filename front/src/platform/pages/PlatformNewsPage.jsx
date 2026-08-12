import { useEffect, useState } from 'react';
import * as managerApi from '../../api/manager.api';
import Icon from '../../components/ui/Icon';
import { submitManagerMutation } from '../../offline/managerMutationQueue';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, PlatformField, StatusPill } from '../components/PlatformUi';
import { usePlatformStore } from '../../store/platformStore';

function formatPublishedAt(value, lang) {
  return new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function PlatformNewsPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const { p, lang } = usePlatformCopy();
  const [selected, setSelected] = useState(null);
  const news = usePlatformStore((state) => state.news);
  const permissions = usePlatformStore((state) => state.permissions);
  const markNewsRead = usePlatformStore((state) => state.markNewsRead);
  const showToast = useUiStore((state) => state.showToast);
  const canManage = permissions.includes('news.manage');
  const [editorOpen, setEditorOpen] = useState(false);
  const [stores, setStores] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', excerpt: '', body: '', category: 'Операции', audienceRole: '', storeId: '' });

  useEffect(() => {
    if (!canManage) return;
    managerApi.getWorkspace().then((workspace) => {
      setStores(workspace.stores || []);
      setForm((current) => ({ ...current, storeId: current.storeId || String(workspace.stores?.[0]?.id || '') }));
    }).catch(() => {});
  }, [canManage]);

  function openArticle(article) {
    setSelected(article);
    if (!article.is_read) markNewsRead(article.id).catch(() => {});
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function publish(event, status = 'published') {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.storeId) {
      setError('Укажите точку, заголовок и текст новости');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitManagerMutation('news.create', { body: {
        title: form.title.trim(), excerpt: form.excerpt.trim() || undefined, body: form.body.trim(),
        category: form.category, audience_role: form.audienceRole || undefined,
        store_id: Number(form.storeId), status,
      } }, userId);
      setEditorOpen(false);
      setForm((current) => ({ title: '', excerpt: '', body: '', category: 'Операции', audienceRole: '', storeId: current.storeId }));
      showToast(result.queued ? 'Нет сети: новость сохранена в очереди' : status === 'published' ? 'Новость опубликована' : 'Черновик сохранён');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить новость');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.platform} title="Новости команды" subtitle="Изменения процессов, обучение и важное из жизни Bahandi" action={canManage ? <PlatformButton icon="plus" onClick={() => setEditorOpen(true)}>Опубликовать</PlatformButton> : null} />
      <div className="mt-6 space-y-3">
        {news.map((article, index) => (
          <button key={article.id} type="button" onClick={() => openArticle(article)} className={`group flex w-full cursor-pointer flex-col gap-4 rounded-[24px] border bg-surface p-5 text-left shadow-card-sm transition-[border-color,background-color,transform] hover:border-green hover:bg-surface2 active:scale-[.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green sm:flex-row sm:items-center sm:p-6 ${index === 0 && !article.is_read ? 'border-orange' : 'border-line'}`}>
            <IconTile icon="book" tone={article.is_read ? 'neutral' : 'green'} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><StatusPill tone={article.is_read ? 'neutral' : 'green'}>{article.category}</StatusPill><span className="text-[11px] text-faint">{formatPublishedAt(article.published_at, lang)}</span></span>
              <span className="mt-3 block font-head text-[20px] font-semibold leading-snug text-text sm:text-[22px]">{article.title}</span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-muted sm:text-[13px]">{article.excerpt}</span>
            </span>
            <Icon name="chevronRight" size={20} className="hidden flex-none text-faint transition-transform group-hover:translate-x-1 sm:block" />
          </button>
        ))}
      </div>

      <PlatformModal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title} subtitle={selected ? formatPublishedAt(selected.published_at, lang) : ''} footer={<PlatformButton onClick={() => setSelected(null)}>Понятно</PlatformButton>}>
        <div className="rounded-2xl bg-green-tint p-4 text-[13px] font-semibold leading-relaxed text-green">{selected?.excerpt}</div>
        <div className="mt-5 space-y-4 text-[13px] leading-[1.75] text-muted">
          <p className="m-0 whitespace-pre-wrap">{selected?.body}</p>
        </div>
      </PlatformModal>

      <PlatformModal open={editorOpen} onClose={() => !submitting && setEditorOpen(false)} title="Новая новость" subtitle="Публикация появится у выбранной аудитории" size="lg" footer={<><PlatformButton variant="secondary" disabled={submitting} onClick={(event) => publish(event, 'draft')}>Сохранить черновик</PlatformButton><PlatformButton loading={submitting} icon="send" onClick={(event) => publish(event, 'published')}>Опубликовать</PlatformButton></>}>
        <form onSubmit={publish} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><PlatformField as="select" label="Торговая точка" value={form.storeId} onChange={(event) => updateForm('storeId', event.target.value)}><option value="">Выберите точку</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</PlatformField><PlatformField as="select" label="Аудитория" value={form.audienceRole} onChange={(event) => updateForm('audienceRole', event.target.value)}><option value="">Все сотрудники точки</option><option value="sender">Сотрудники</option><option value="manager">Менеджеры</option></PlatformField></div><div className="grid gap-4 sm:grid-cols-[1fr_220px]"><PlatformField label="Заголовок" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Коротко о главном" /><PlatformField as="select" label="Рубрика" value={form.category} onChange={(event) => updateForm('category', event.target.value)}><option>Операции</option><option>Обучение</option><option>Команда</option><option>Безопасность</option><option>Важно</option></PlatformField></div><PlatformField as="textarea" rows={2} label="Краткое описание" value={form.excerpt} onChange={(event) => updateForm('excerpt', event.target.value)} maxLength={500} placeholder="Одна-две строки для карточки новости" /><PlatformField as="textarea" rows={7} label="Текст новости" value={form.body} onChange={(event) => updateForm('body', event.target.value)} placeholder="Расскажите, что изменилось и что нужно сделать сотруднику" />{error && <div role="alert" className="rounded-2xl bg-red-tint p-3 text-[12px] font-semibold text-red">{error}</div>}<button type="submit" className="sr-only">Опубликовать</button></form>
      </PlatformModal>
    </div>
  );
}
