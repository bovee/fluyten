import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/translation.json';
import zhHans from './locales/zh-Hans/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import hi from './locales/hi/translation.json';
import ar from './locales/ar/translation.json';
import ja from './locales/ja/translation.json';
import pt from './locales/pt/translation.json';
import ru from './locales/ru/translation.json';
import de from './locales/de/translation.json';
import id from './locales/id/translation.json';
import ko from './locales/ko/translation.json';
import bn from './locales/bn/translation.json';
import ur from './locales/ur/translation.json';

const isTest = import.meta.env.MODE === 'test';

function getStoredLanguage(): string | undefined {
  try {
    const raw = localStorage.getItem('fluyten-settings');
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as { state?: { language?: string } };
    return stored?.state?.language || undefined;
  } catch {
    return undefined;
  }
}

if (!isTest) i18n.use(LanguageDetector);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
    es: { translation: es },
    fr: { translation: fr },
    hi: { translation: hi },
    ar: { translation: ar },
    ja: { translation: ja },
    pt: { translation: pt },
    ru: { translation: ru },
    de: { translation: de },
    id: { translation: id },
    ko: { translation: ko },
    bn: { translation: bn },
    ur: { translation: ur },
  },
  lng: isTest ? 'en' : getStoredLanguage(),
  fallbackLng: 'en',
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
  },
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});

export default i18n;

export const RTL_LANGUAGES = new Set(['ar', 'ur']);
