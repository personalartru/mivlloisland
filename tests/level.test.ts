import { describe, expect, it } from 'vitest'
import { CONTENT, CLOCKWORK_CONTENT, ISLAND_CONTENT, PLANET_CONTENT } from '../src/game/content'
import { ISLAND_LAYOUT, PLANET_LAYOUT, CLOCKWORK_LAYOUT, type LevelLayout } from '../src/game/layout'
import { rng } from '../src/game/world/shared'

const LEVELS: Array<[string, LevelLayout, typeof ISLAND_CONTENT]> = [
  ['Чудо-остров', ISLAND_LAYOUT, ISLAND_CONTENT],
  ['Планета Звёздная', PLANET_LAYOUT, PLANET_CONTENT],
  ['Механический город', CLOCKWORK_LAYOUT, CLOCKWORK_CONTENT],
]

describe.each(LEVELS)('%s layout', (_name, layout, content) => {
  it('keeps every resident and collectible inside the safe playable area', () => {
    for (const spot of Object.values(layout.npcSpots)) {
      expect(Math.hypot(spot.x, spot.z)).toBeLessThan(layout.playableRadius - 1)
    }
    for (const spots of Object.values(layout.itemSpots)) {
      for (const spot of spots ?? []) {
        expect(Math.hypot(spot.x, spot.z)).toBeLessThan(layout.playableRadius - 1)
        expect(Math.hypot(spot.x - layout.spawn.x, spot.z - layout.spawn.z)).toBeGreaterThan(2)
        expect(spot.y).toBeCloseTo(0.7)
      }
    }
  })

  it('places exactly the items each resident asks for', () => {
    let total = 0
    for (const quest of content.quests) {
      expect(layout.itemSpots[quest.item]).toHaveLength(quest.need)
      total += layout.itemSpots[quest.item]!.length
    }
    expect(total).toBe(content.totalItems)
  })

  it('gives every resident a spot and a distinct place to stand', () => {
    const spots = content.quests.map(quest => layout.npcSpots[quest.id])
    expect(spots.every(Boolean)).toBe(true)
    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.z - spots[j]!.z)).toBeGreaterThan(5)
      }
    }
  })

  it('keeps pickups out of the water and away from residents, buildings and the landmark', () => {
    for (const spots of Object.values(layout.itemSpots)) {
      for (const spot of spots ?? []) {
        expect(Math.hypot(spot.x - layout.water.center.x, spot.z - layout.water.center.z)).toBeGreaterThan(layout.water.radius + 0.4)
        for (const npc of Object.values(layout.npcSpots)) expect(Math.hypot(spot.x - npc.x, spot.z - npc.z)).toBeGreaterThan(2)
        expect(Math.hypot(spot.x - layout.building.x, spot.z - layout.building.z)).toBeGreaterThan(3)
        expect(Math.hypot(spot.x - layout.landmark.x, spot.z - layout.landmark.z)).toBeGreaterThan(2.5)
      }
    }
  })

  it('keeps residents out of the water and the landmark plinth', () => {
    for (const npc of Object.values(layout.npcSpots)) {
      expect(Math.hypot(npc.x - layout.water.center.x, npc.z - layout.water.center.z)).toBeGreaterThan(layout.water.radius)
      expect(Math.hypot(npc.x - layout.landmark.x, npc.z - layout.landmark.z)).toBeGreaterThan(4)
    }
  })

  it('is deterministic so children always find the same world', () => {
    const a = rng(layout.seed)
    const b = rng(layout.seed)
    for (let i = 0; i < 8; i += 1) expect(a()).toBe(b())
  })
})

describe('the cosmic level is bigger than the island', () => {
  it('adds more friends and more tasks than the first level', () => {
    expect(PLANET_CONTENT.quests.length).toBeGreaterThan(ISLAND_CONTENT.quests.length)
    expect(PLANET_CONTENT.totalItems).toBeGreaterThan(ISLAND_CONTENT.totalItems)
    expect(PLANET_CONTENT.quests.map(q => q.id)).not.toEqual(ISLAND_CONTENT.quests.map(q => q.id))
  })

  it('uses its own collectibles, not the island ones', () => {
    const island = new Set(ISLAND_CONTENT.itemKinds)
    for (const kind of PLANET_CONTENT.itemKinds) expect(island.has(kind)).toBe(false)
    expect(new Set(PLANET_CONTENT.itemKinds).size).toBe(PLANET_CONTENT.itemKinds.length)
  })

  it('registers both levels in the content table', () => {
    expect(CONTENT.island).toBe(ISLAND_CONTENT)
    expect(CONTENT.planet).toBe(PLANET_CONTENT)
  })
})

describe('the clockwork level', () => {
  it('has new tasks and interactive machine zones', () => {
    expect(CLOCKWORK_CONTENT.quests).toHaveLength(5)
    expect(CLOCKWORK_CONTENT.totalItems).toBe(17)
    expect(CLOCKWORK_LAYOUT.clockwork?.plates).toHaveLength(5)
    expect(CLOCKWORK_LAYOUT.clockwork?.speedPads).toHaveLength(3)
    expect(CONTENT.clockwork).toBe(CLOCKWORK_CONTENT)
  })
})
