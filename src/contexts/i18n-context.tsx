'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Locale = 'pt' | 'en' | 'es' | 'zh' | 'ar' | 'fr' | 'hi' | 'ru' | 'de' | 'ja';

export const LOCALES: { code: Locale; label: string; flag: string; dir?: 'rtl' }[] = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'zh', label: '中文',       flag: '🇨🇳' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦', dir: 'rtl' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'hi', label: 'हिन्दी',    flag: '🇮🇳' },
  { code: 'ru', label: 'Русский',   flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵' },
];

// Deep-get a nested key like 'metrics.price.tip'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'pt',
  setLocale: () => {},
  t: (k) => k,
  dir: 'ltr',
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any>({});

  const loadMessages = useCallback(async (l: Locale) => {
    try {
      const mod = await import(`@/i18n/locales/${l}.json`);
      setMessages(mod.default ?? mod);
    } catch {
      // fallback to pt
      const mod = await import('@/i18n/locales/pt.json');
      setMessages(mod.default ?? mod);
    }
  }, []);

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('locale')) as Locale | null;
    const initial: Locale = saved && LOCALES.some(l => l.code === saved) ? saved : 'pt';
    setLocaleState(initial);
    loadMessages(initial);
  }, [loadMessages]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
    loadMessages(l);
    // Update <html dir> for RTL support
    const localeInfo = LOCALES.find(x => x.code === l);
    document.documentElement.dir = localeInfo?.dir ?? 'ltr';
    document.documentElement.lang = l;
  }, [loadMessages]);

  const t = useCallback((key: string) => deepGet(messages, key), [messages]);
  const dir = LOCALES.find(l => l.code === locale)?.dir ?? 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
