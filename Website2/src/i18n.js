import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonPL from './locales/pl/common.json';
import landingPL from './locales/pl/landing.json';
import devicePL  from './locales/pl/device.json';
import appPL     from './locales/pl/app.json';
import aboutPL   from './locales/pl/about.json';
import opinionsPL from './locales/pl/opinions.json';

import commonEN from './locales/en/common.json';
import landingEN from './locales/en/landing.json';
import deviceEN  from './locales/en/device.json';
import appEN     from './locales/en/app.json';
import aboutEN   from './locales/en/about.json';
import opinionsEN from './locales/en/opinions.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: {
        common:   commonPL,
        landing:  landingPL,
        device:   devicePL,
        app:      appPL,
        about:    aboutPL,
        opinions: opinionsPL,
      },
      en: {
        common:   commonEN,
        landing:  landingEN,
        device:   deviceEN,
        app:      appEN,
        about:    aboutEN,
        opinions: opinionsEN,
      },
    },
    fallbackLng: 'pl',
    supportedLngs: ['pl', 'en'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rythmio-lang',
    },
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
