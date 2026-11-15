import { describe, expect, it } from 'vitest'
import ru from '../src/i18n/ru.json'
import { ISLAND_CONTENT, PLANET_CONTENT, itemDef, questByItem, type LevelContent } from '../src/game/content'

const LEVELS: LevelContent[] = [ISLAND_CONTENT, PLANET_CONTENT]

const QUEST_KEYS = ['name', 'title', 'intro', 'progress', 'ready', 'thanks', 'done'] as const

describe.each(LEVELS)('$id content', content => {
  it('describes every collectible in Russian', () => {
    for (const kind of content.itemKinds) {
      const def = itemDef(content, kind)
      expect(def.nameKey).toBe(`item.${kind}`)
      expect((ru as Record<string, string>)[def.nameKey]?.trim()).toBeTruthy()
      expect(def.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(def.glow).toMatch(/^#[0-9a-f]{6}$/i)
      expect(def.height).toBeGreaterThan(0.2)
      expect(def.halo).toBeGreaterThan(1)
    }
  })

  it('gives every resident a name, a task and all seven spoken lines', () => {
    const names = new Set<string>()
    for (const quest of content.quests) {
      for (const suffix of QUEST_KEYS) {
        const key = `quest.${quest.id}.${suffix}`
        expect(key).toBe(quest[`${suffix}Key` as const])
        const value = (ru as Record<string, string>)[key]
        expect(value, key).toBeTruthy()
        expect(value.trim().length, key).toBeGreaterThan(suffix === 'name' ? 2 : 8)
      }
      expect(names.has(quest.nameKey)).toBe(false)
      names.add(quest.nameKey)
      expect(quest.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(quest.need).toBeGreaterThan(1)
      expect(questByItem(content, quest.item)?.id).toBe(quest.id)
    }
    expect(new Set(content.quests.map(q => q.id)).size).toBe(content.quests.length)
    expect(new Set(content.quests.map(q => q.item)).size).toBe(content.quests.length)
  })

  it('asks for exactly as many wonders as the level contains', () => {
    const needed = content.quests.reduce((sum, quest) => sum + quest.need, 0)
    expect(needed).toBe(content.totalItems)
    const placed = content.itemKinds.reduce((sum, kind) => sum + (content.layout.itemSpots[kind]?.length ?? 0), 0)
    expect(placed).toBe(content.totalItems)
  })

  it('has per-level HUD, hint and celebration copy', () => {
    for (const key of [content.noTasksKey, content.collectHintKey, content.resultsWonKey, content.resultsThanksKey]) {
      expect((ru as Record<string, string>)[key]?.trim(), key).toBeTruthy()
    }
  })
})

describe('cosmic content', () => {
  it('introduces six new friends instead of reusing the island cast', () => {
    const islandIds = new Set(ISLAND_CONTENT.quests.map(q => q.id))
    for (const quest of PLANET_CONTENT.quests) expect(islandIds.has(quest.id)).toBe(false)
  })

  it('keeps the island unchanged at four tasks and sixteen items', () => {
    expect(ISLAND_CONTENT.quests.map(q => q.id)).toEqual(['grandma', 'fairy', 'mushroom', 'cat'])
    expect(ISLAND_CONTENT.totalItems).toBe(16)
  })

  it('names the cosmic friends and wonders in Russian', () => {
    expect(ru['quest.lumo.name']).toBe('Люмо')
    expect(ru['quest.whale.name']).toBe('Кит Гром')
    expect(ru['item.stardust']).toBe('Звёздная пылинка')
    expect(ru['results.planet.won']).toBe('Парад планет!')
  })
})
