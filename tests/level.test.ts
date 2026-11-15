import { describe, expect, it } from 'vitest'
import { QUESTS, TOTAL_ITEMS } from '../src/game/quests'
import { WORLD, rng } from '../src/game/world'

describe('Чудо-остров', () => {
  it('keeps every resident and collectible inside the safe playable island', () => {
    for (const spot of Object.values(WORLD.npcSpots)) {
      expect(Math.hypot(spot.x, spot.z)).toBeLessThan(WORLD.playableRadius - 1)
    }
    for (const spots of Object.values(WORLD.itemSpots)) {
      for (const spot of spots) {
        expect(Math.hypot(spot.x, spot.z)).toBeLessThan(WORLD.playableRadius - 1)
        expect(Math.hypot(spot.x - WORLD.spawn.x, spot.z - WORLD.spawn.z)).toBeGreaterThan(2)
        expect(spot.y).toBeCloseTo(0.7)
      }
    }
  })

  it('places exactly the items each resident asks for', () => {
    let total = 0
    for (const quest of QUESTS) {
      expect(WORLD.itemSpots[quest.item]).toHaveLength(quest.need)
      total += WORLD.itemSpots[quest.item].length
    }
    expect(total).toBe(TOTAL_ITEMS)
    expect(TOTAL_ITEMS).toBe(16)
  })

  it('keeps pickups out of the pond and away from residents, buildings and the tree', () => {
    for (const spots of Object.values(WORLD.itemSpots)) {
      for (const spot of spots) {
        expect(Math.hypot(spot.x - WORLD.pond.center.x, spot.z - WORLD.pond.center.z)).toBeGreaterThan(WORLD.pond.radius + 0.4)
        for (const npc of Object.values(WORLD.npcSpots)) expect(Math.hypot(spot.x - npc.x, spot.z - npc.z)).toBeGreaterThan(2)
        expect(Math.hypot(spot.x - WORLD.cottage.x, spot.z - WORLD.cottage.z)).toBeGreaterThan(3)
        expect(Math.hypot(spot.x - WORLD.tree.x, spot.z - WORLD.tree.z)).toBeGreaterThan(2.5)
      }
    }
  })

  it('is deterministic so children always find the same island', () => {
    const a = rng(7)
    const b = rng(7)
    for (let i = 0; i < 8; i += 1) expect(a()).toBe(b())
  })
})
