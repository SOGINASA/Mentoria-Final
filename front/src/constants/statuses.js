// Статусы заявки на списание. Совпадают с back/constants.py
export const STATUS_PENDING = 'pending'; // На проверке
export const STATUS_APPROVED = 'approved'; // Подтверждена
export const STATUS_REJECTED = 'rejected'; // Отклонена

// Цветовая схема статусов (ключи токенов Tailwind/CSS-переменных)
export const STATUS_STYLE = {
  [STATUS_PENDING]: { fg: 'var(--amber)', bg: 'var(--amber-tint)' },
  [STATUS_APPROVED]: { fg: 'var(--gst)', bg: 'var(--gst-tint)' },
  [STATUS_REJECTED]: { fg: 'var(--red)', bg: 'var(--red-tint)' },
};
