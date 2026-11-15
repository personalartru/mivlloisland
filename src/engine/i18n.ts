import ru from '../i18n/ru.json'
import type { Locale } from './save'

export type Dictionary = Record<string, string>
const DICTIONARIES: Record<Locale, Dictionary> = { ru }

/** The game is authored and shipped in Russian only; the locale never follows the browser. */
export function detectLocale(): Locale {
  return 'ru'
}

export function resolveLocale(): Locale {
  return 'ru'
}

export class I18n {
  locale: Locale = 'ru'
  private listeners = new Set<(locale: Locale) => void>()

  constructor(locale: Locale = 'ru') {
    this.locale = locale
    document.documentElement.lang = locale
  }

  /** Look up `key`, replacing `{name}` placeholders. Missing keys render the key so gaps are visible. */
  t(key: string, vars: Record<string, string | number> = {}): string {
    const text = DICTIONARIES[this.locale][key] ?? key
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
  }

  set(locale: Locale): void {
    if (locale === this.locale) return
    this.locale = locale
    document.documentElement.lang = locale
    for (const fn of this.listeners) fn(locale)
  }

  onChange(fn: (locale: Locale) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export const DICTIONARY_KEYS = { ru: Object.keys(ru) }
