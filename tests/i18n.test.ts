import { afterEach, describe, expect, it, vi } from 'vitest'
import ru from '../src/i18n/ru.json'
import { DICTIONARY_KEYS, I18n, detectLocale, resolveLocale } from '../src/engine/i18n'

afterEach(() => vi.unstubAllGlobals())

describe('i18n', () => {
  it('never follows the browser and always ships Russian', () => {
    expect(detectLocale()).toBe('ru')
    expect(resolveLocale()).toBe('ru')
  })

  it('contains complete, non-empty Russian strings', () => {
    expect(DICTIONARY_KEYS.ru.sort()).toEqual(Object.keys(ru).sort())
    expect(Object.keys(ru).length).toBeGreaterThan(100)
    for (const [key, value] of Object.entries(ru)) {
      expect(value.trim(), key).not.toBe('')
      expect(value, key).not.toMatch(/[A-Za-z]{4,} [A-Za-z]{4,}/)
    }
  })

  it('uses Mivlik throughout Russian quest dialogue and final copy', () => {
    for (const [key, value] of Object.entries(ru)) {
      if (key.startsWith('quest.')) expect(value, key).not.toMatch(/мурзик/i)
    }
    expect(ru['final.sub']).not.toMatch(/мурзик/i)
    expect(ru['quest.summit.thanks']).toContain('Мивлик')
  })

  it('labels the public leaderboard name as a nickname and warns against personal details', () => {
    expect(ru['menu.nameLabel']).toBe('Игровой ник')
    expect(ru['menu.namePrivacy']).toContain('виден другим игрокам')
    expect(ru['menu.namePrivacy']).toMatch(/настоящее имя.*телефон.*адрес/)
  })

  it('interpolates placeholders and exposes missing keys instead of hiding them', () => {
    vi.stubGlobal('document', { documentElement: { lang: '' } })
    const i18n = new I18n('ru')
    expect(i18n.t('hud.compassItem', { item: 'земляника', m: 4 })).toBe('земляника: 4 м')
    expect(i18n.t('quest.grandma.progress', { n: 2 })).toContain('2')
    expect(i18n.t('missing.key')).toBe('missing.key')
    expect(document.documentElement.lang).toBe('ru')
  })
})
