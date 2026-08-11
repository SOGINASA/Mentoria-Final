import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useUiStore } from '../../store/uiStore';
import { usePlatformStore } from '../../store/platformStore';
import { EMPLOYEE_DOCUMENTS } from '../platformData';
import PlatformModal from '../components/PlatformModal';
import { IconTile, PageIntro, PlatformButton, PlatformCard, PlatformField, SectionHeading, StatusPill } from '../components/PlatformUi';

const STATUS = {
  processing: { label: 'Формируется', tone: 'amber' },
  ready: { label: 'Готов', tone: 'green' },
};

export default function PlatformDocumentsPage() {
  const showToast = useUiStore((state) => state.showToast);
  const requests = usePlatformStore((state) => state.documentRequests);
  const createDocumentRequest = usePlatformStore((state) => state.createDocumentRequest);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const visibleDocuments = useMemo(() => EMPLOYEE_DOCUMENTS.filter((document) => (
    document.title.toLowerCase().includes(query.trim().toLowerCase())
  )), [query]);

  async function requestDocument(document) {
    const existing = requests.find((request) => request.documentId === document.id && request.status === 'processing');
    if (existing) {
      showToast(`Заявка ${existing.id} уже обрабатывается`);
      return;
    }
    try {
      const request = await createDocumentRequest({ documentId: document.id, title: document.title });
      setSelected(null);
      showToast(`Заявка ${request.id} создана`);
    } catch (error) {
      showToast(error.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <PageIntro eyebrow="Кадровый кабинет" title="Мои документы" subtitle="Актуальные документы сотрудника и история запросов в одном разделе." />

      <div className="mt-6 max-w-xl">
        <PlatformField label="Поиск документа" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, расчётный лист" />
      </div>

      <section className="mt-7">
        <SectionHeading title="Доступные документы" />
        <PlatformCard className="overflow-hidden">
          {visibleDocuments.map((document) => {
            const activeRequest = requests.find((request) => request.documentId === document.id && request.status === 'processing');
            return (
              <div key={document.id} className="flex min-h-[86px] items-center gap-3 border-b border-line2 p-4 last:border-b-0 sm:px-5">
                <IconTile icon="fileText" tone={document.available ? 'green' : 'amber'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-[13px] font-bold text-text">{document.title}</h3>
                    {activeRequest && <StatusPill tone="amber">Формируется</StatusPill>}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted">{document.updatedAt} • {document.meta}</div>
                </div>
                <button type="button" onClick={() => setSelected(document)} className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-surface2 text-green transition-colors hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green" aria-label={`${document.available ? 'Открыть' : 'Запросить'} ${document.title}`}>
                  <Icon name={document.available ? 'chevronRight' : 'send'} size={19} />
                </button>
              </div>
            );
          })}
          {!visibleDocuments.length && <div className="p-8 text-center text-[13px] text-muted">По вашему запросу документы не найдены.</div>}
        </PlatformCard>
      </section>

      <section className="mt-7">
        <SectionHeading title="Мои запросы" />
        {requests.length ? (
          <PlatformCard className="overflow-hidden">
            {requests.map((request) => {
              const status = STATUS[request.status] || STATUS.processing;
              return (
                <div key={request.id} className="flex min-h-[76px] items-center gap-3 border-b border-line2 p-4 last:border-b-0 sm:px-5">
                  <IconTile icon="history" tone={status.tone} size="sm" />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-bold text-text">{request.title}</div><div className="mt-1 text-[11px] text-muted">{request.id} • {new Intl.DateTimeFormat('ru-RU').format(new Date(request.createdAt))}</div></div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
              );
            })}
          </PlatformCard>
        ) : (
          <PlatformCard className="p-6 text-center text-[13px] text-muted">У вас пока нет запросов на формирование документов.</PlatformCard>
        )}
      </section>

      <PlatformModal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || 'Документ'} subtitle={selected?.category} footer={<><PlatformButton variant="secondary" onClick={() => setSelected(null)}>Закрыть</PlatformButton><PlatformButton icon={selected?.available ? 'download' : 'send'} onClick={() => requestDocument(selected)}>{selected?.available ? 'Запросить новую копию' : 'Сформировать документ'}</PlatformButton></>}>
        {selected && (
          <div className="rounded-2xl bg-surface2 p-5">
            <IconTile icon="fileText" tone={selected.available ? 'green' : 'amber'} />
            <div className="mt-4 text-[13px] font-bold text-text">{selected.available ? 'Документ доступен в кадровой системе' : 'Документ формируется по заявке'}</div>
            <p className="mb-0 mt-2 text-[12px] leading-relaxed text-muted">{selected.available ? 'Для получения актуальной защищённой копии отправьте запрос в кадровую систему.' : `Обычный срок подготовки: ${selected.meta}. Статус появится в списке запросов.`}</p>
          </div>
        )}
      </PlatformModal>
    </div>
  );
}
