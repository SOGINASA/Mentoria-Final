// Форматтеры дат и инициалов.

const MONTHS_SHORT = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * ISO-дата -> человекочитаемая метка вида «Сегодня, 14:20» / «Вчера, 12:05» / «13.06, 09:15».
 * @param {string} iso
 * @param {'ru'|'kz'} lang
 */
export function dateLabel(iso, lang = 'ru') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (sameDay(d, now)) return `${lang === 'ru' ? 'Сегодня' : 'Бүгін'}, ${time}`;
  if (sameDay(d, yesterday)) return `${lang === 'ru' ? 'Вчера' : 'Кеше'}, ${time}`;
  return `${pad(d.getDate())}.${MONTHS_SHORT[d.getMonth()]}, ${time}`;
}

/** Инициалы из ФИО: «Алибек Нурлан» -> «АН». */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
