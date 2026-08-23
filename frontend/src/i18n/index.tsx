import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { zh } from './locales/zh';
import { en } from './locales/en';

export type Locale = 'zh' | 'en';

export type TranslateVars = Record<string, string | number>;
export type TranslateFn = (key: string, vars?: TranslateVars) => string;

const LOCALE_STORAGE_KEY = 'trycode_lang';

type Dict = Record<keyof typeof zh, string>;

const dictionaries: Record<Locale, Dict> = { zh, en };

function isLocale(value: unknown): value is Locale {
  return value === 'zh' || value === 'en';
}

function getInitialLocale(): Locale {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) return saved;
    }
  } catch {
    // localStorage unavailable (SSR or privacy mode), fall through
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return 'en';
}

let currentLocale: Locale = getInitialLocale();
const listeners = new Set<(locale: Locale) => void>();

export function setLocale(next: Locale): void {
  if (!isLocale(next) || next === currentLocale) return;
  currentLocale = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  } catch {
    // ignore persistence failures
  }
  listeners.forEach((notify) => notify(next));
}

export function getLocale(): Locale {
  return currentLocale;
}

function lookup(dict: Dict, key: string): string | undefined {
  return (dict as Record<string, string | undefined>)[key];
}

function translate(locale: Locale, key: string, vars?: TranslateVars): string {
  const template = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => currentLocale);

  useEffect(() => {
    const notify = (next: Locale) => setLocaleState(next);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    }
  }, [locale]);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
  }, []);

  const t = useMemo<TranslateFn>(
    () => (key: string, vars?: TranslateVars) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale: changeLocale, t }),
    [locale, changeLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  return ctx ? ctx.locale : currentLocale;
}

export function useT(): TranslateFn {
  const ctx = useContext(I18nContext);
  const locale = ctx ? ctx.locale : currentLocale;
  return useMemo<TranslateFn>(
    () => (key: string, vars?: TranslateVars) => translate(locale, key, vars),
    [locale]
  );
}
