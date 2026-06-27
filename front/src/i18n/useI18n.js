import { useUiStore } from '../store/uiStore';
import { translations } from './translations';

// Возвращает { t, lang, setLang }. t — словарь активного языка.
export function useI18n() {
  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  return { t: translations[lang] || translations.ru, lang, setLang };
}
