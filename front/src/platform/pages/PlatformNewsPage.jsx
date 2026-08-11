import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { usePlatformCopy } from '../platformCopy';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, StatusPill } from '../components/PlatformUi';
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
  const { p, lang } = usePlatformCopy();
  const [selected, setSelected] = useState(null);
  const news = usePlatformStore((state) => state.news);
  const markNewsRead = usePlatformStore((state) => state.markNewsRead);

  function openArticle(article) {
    setSelected(article);
    if (!article.is_read) markNewsRead(article.id).catch(() => {});
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow={p.platform} title="Новости команды" subtitle="Изменения процессов, обучение и важное из жизни Bahandi" />
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
    </div>
  );
}
