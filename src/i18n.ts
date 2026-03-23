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
import it from './locales/it/translation.json';
import nl from './locales/nl/translation.json';
import pl from './locales/pl/translation.json';
import fa from './locales/fa/translation.json';
import vi from './locales/vi/translation.json';
import cs from './locales/cs/translation.json';
import uk from './locales/uk/translation.json';
import hu from './locales/hu/translation.json';
import et from './locales/et/translation.json';
import yue from './locales/yue/translation.json';
import zhHant from './locales/zh-Hant/translation.json';
import mr from './locales/mr/translation.json';
import te from './locales/te/translation.json';
import ta from './locales/ta/translation.json';
import el from './locales/el/translation.json';
import da from './locales/da/translation.json';
import fi from './locales/fi/translation.json';
import sv from './locales/sv/translation.json';
import ro from './locales/ro/translation.json';
import he from './locales/he/translation.json';
import th from './locales/th/translation.json';
import nb from './locales/nb/translation.json';
import sk from './locales/sk/translation.json';
import hr from './locales/hr/translation.json';
import pa from './locales/pa/translation.json';
import jv from './locales/jv/translation.json';
import sw from './locales/sw/translation.json';
import ha from './locales/ha/translation.json';
import tl from './locales/tl/translation.json';
import gu from './locales/gu/translation.json';

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
    it: { translation: it },
    nl: { translation: nl },
    pl: { translation: pl },
    fa: { translation: fa },
    vi: { translation: vi },
    cs: { translation: cs },
    uk: { translation: uk },
    hu: { translation: hu },
    et: { translation: et },
    yue: { translation: yue },
    'zh-Hant': { translation: zhHant },
    mr: { translation: mr },
    te: { translation: te },
    ta: { translation: ta },
    el: { translation: el },
    da: { translation: da },
    fi: { translation: fi },
    sv: { translation: sv },
    ro: { translation: ro },
    he: { translation: he },
    th: { translation: th },
    nb: { translation: nb },
    sk: { translation: sk },
    hr: { translation: hr },
    pa: { translation: pa },
    jv: { translation: jv },
    sw: { translation: sw },
    ha: { translation: ha },
    tl: { translation: tl },
    gu: { translation: gu },
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

export const RTL_LANGUAGES = new Set(['ar', 'ur', 'fa', 'he']);
