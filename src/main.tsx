import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import i18n, { RTL_LANGUAGES } from './i18n';
import App from './App.tsx';

function applyDir(lang: string) {
  document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

applyDir(i18n.resolvedLanguage ?? i18n.language);
i18n.on('languageChanged', applyDir);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
