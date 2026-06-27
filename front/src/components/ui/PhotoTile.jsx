import Icon from './Icon';

// Превью фото заявки. Если url есть — показываем изображение, иначе декоративную плитку.
export default function PhotoTile({ url, className = '', rounded = 'rounded-2xl', iconSize = 26 }) {
  return (
    <div
      className={`relative overflow-hidden tile-base ${rounded} ${className}`}
      style={{ boxShadow: 'var(--tile-ring)' }}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-faint">
          <Icon name="camera" size={iconSize} strokeWidth={1.7} />
        </span>
      )}
    </div>
  );
}
