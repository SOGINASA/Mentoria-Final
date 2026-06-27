import { useState } from 'react';
import Icon from '../ui/Icon';
import { useI18n } from '../../i18n/useI18n';

// Крупное фото заявки + миниатюры. Клик открывает на весь экран.
export default function BigPhoto({ photos = [], showZoom = false }) {
  const { t } = useI18n();
  const urls = photos.map((p) => p.url).filter(Boolean);
  const [active, setActive] = useState(0);
  const [full, setFull] = useState(false);
  const main = urls[active];

  return (
    <div>
      <div
        onClick={() => main && setFull(true)}
        className="relative w-full rounded-[20px] overflow-hidden tile-base cursor-zoom-in"
        style={{ aspectRatio: '4 / 3', boxShadow: 'var(--shadow), var(--tile-ring)' }}
      >
        {main ? (
          <img src={main} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-faint">
            <Icon name="camera" size={64} strokeWidth={1.4} />
          </span>
        )}
        {showZoom && main && (
          <div
            className="absolute bottom-3 right-3 text-white text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ background: 'rgba(0,0,0,.5)' }}
          >
            <Icon name="zoom" size={13} />
            {t.zoom}
          </div>
        )}
      </div>

      {urls.length > 1 && (
        <div className="flex gap-2 mt-3">
          {urls.map((u, i) => (
            <button
              key={u}
              onClick={() => setActive(i)}
              className="w-14 h-14 rounded-xl overflow-hidden tile-base border-2 transition"
              style={{ borderColor: i === active ? 'var(--green)' : 'transparent' }}
            >
              <img src={u} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {full && (
        <div
          onClick={() => setFull(false)}
          className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-5 animate-fadeIn cursor-zoom-out"
        >
          <img src={main} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
