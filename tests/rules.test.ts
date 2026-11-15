import { describe, expect, it } from 'vitest'
import { CONFIG } from '../src/game/config'
import { ISLAND_CONTENT, PLANET_CONTENT, type LevelContent } from '../src/game/content'
import {
  acceptQuest, allDone, completedCount, createJourney, formatDuration, isReady,
  missingFor, pickup, starsOf, tick, turnIn,
} from '../src/game/rules'

function completeAll(content: LevelContent) {
  let s = createJourney(content)
  for (const quest of content.quests) {
    s = acceptQuest(s, quest.id).state
    for (let i = 0; i < quest.need; i += 1) s = pickup(s, quest.item, content).state
    s = turnIn(s, quest.id, content).state
  }
  return s
}

describe('journey rules', () => {
  it('starts a friendly journey with no tasks, no items and no losing state', () => {
    const s = createJourney(ISLAND_CONTENT)
    expect(s.level).toBe('island')
    expect(s.phase).toBe('playing')
    expect(s.score).toBe(0)
    expect(s.totalCollected).toBe(0)
    expect(completedCount(s, ISLAND_CONTENT)).toBe(0)
    expect(Object.values(s.quests).every(v => v === 'available')).toBe(true)
    expect(s).not.toHaveProperty('lives')
    expect(s).not.toHaveProperty('timeLeft')
  })

  it('collects items into the backpack and scores every pickup', () => {
    const s = pickup(createJourney(ISLAND_CONTENT), 'berry', ISLAND_CONTENT).state
    expect(s.inventory.berry).toBe(1)
    expect(s.totalCollected).toBe(1)
    expect(s.score).toBe(CONFIG.quest.itemPoints)
  })

  it('requires enough items before a resident accepts a task turn-in', () => {
    let s = acceptQuest(createJourney(ISLAND_CONTENT), 'grandma').state
    expect(s.quests.grandma).toBe('active')
    expect(missingFor(s, 'grandma', ISLAND_CONTENT)).toBe(5)
    expect(isReady(s, 'grandma', ISLAND_CONTENT)).toBe(false)
    expect(turnIn(s, 'grandma', ISLAND_CONTENT).completed).toBe(false)
    for (let i = 0; i < 4; i += 1) s = pickup(s, 'berry', ISLAND_CONTENT).state
    expect(missingFor(s, 'grandma', ISLAND_CONTENT)).toBe(1)
    expect(turnIn(s, 'grandma', ISLAND_CONTENT).completed).toBe(false)
    s = pickup(s, 'berry', ISLAND_CONTENT).state
    expect(isReady(s, 'grandma', ISLAND_CONTENT)).toBe(true)
    const done = turnIn(s, 'grandma', ISLAND_CONTENT)
    expect(done.completed).toBe(true)
    expect(done.state.quests.grandma).toBe('done')
    expect(done.state.inventory.berry).toBe(5)
    expect(done.state.phase).toBe('playing')
  })

  it('does not accept the same task twice and keeps completed tasks completed', () => {
    let s = acceptQuest(createJourney(ISLAND_CONTENT), 'fairy').state
    expect(acceptQuest(s, 'fairy').accepted).toBe(false)
    for (let i = 0; i < 4; i += 1) s = pickup(s, 'crystal', ISLAND_CONTENT).state
    s = turnIn(s, 'fairy', ISLAND_CONTENT).state
    expect(acceptQuest(s, 'fairy').accepted).toBe(false)
    expect(turnIn(s, 'fairy', ISLAND_CONTENT).completed).toBe(false)
  })

  it('celebrates only after all four island residents are helped, with a fixed fair score', () => {
    const s = completeAll(ISLAND_CONTENT)
    expect(s.phase).toBe('won')
    expect(allDone(s, ISLAND_CONTENT)).toBe(true)
    expect(completedCount(s, ISLAND_CONTENT)).toBe(4)
    expect(s.totalCollected).toBe(16)
    expect(s.score).toBe(16 * CONFIG.quest.itemPoints + 4 * CONFIG.quest.questPoints + CONFIG.quest.finishBonus)
    expect(starsOf(s)).toBe(3)
    expect(s.phase).not.toBe('lost')
  })

  it('runs a longer cosmic journey with six friends and twenty-four wonders', () => {
    let s = createJourney(PLANET_CONTENT)
    expect(s.level).toBe('planet')
    expect(PLANET_CONTENT.quests).toHaveLength(6)
    expect(PLANET_CONTENT.totalItems).toBe(24)
    s = completeAll(PLANET_CONTENT)
    expect(s.phase).toBe('won')
    expect(completedCount(s, PLANET_CONTENT)).toBe(6)
    expect(s.totalCollected).toBe(24)
    expect(s.score).toBe(24 * CONFIG.quest.itemPoints + 6 * CONFIG.quest.questPoints + CONFIG.quest.finishBonus)
  })

  it('keeps the two levels independent: island items do not fill cosmic tasks', () => {
    let s = acceptQuest(createJourney(PLANET_CONTENT), 'lumo').state
    for (let i = 0; i < 10; i += 1) s = pickup(s, 'berry', PLANET_CONTENT).state
    expect(missingFor(s, 'lumo', PLANET_CONTENT)).toBe(5)
    expect(isReady(s, 'lumo', PLANET_CONTENT)).toBe(false)
  })

  it('freezes time and pickups after the celebration starts', () => {
    const won = completeAll(PLANET_CONTENT)
    expect(tick(won, 10)).toBe(won)
    expect(pickup(won, 'spark', PLANET_CONTENT).gained).toBe(0)
  })

  it('counts the walk time until the celebration, without a time limit', () => {
    let s = tick(createJourney(ISLAND_CONTENT), 12.5)
    expect(s.elapsed).toBe(12.5)
    s = tick(s, 3600)
    expect(s.elapsed).toBe(3612.5)
    expect(s.phase).toBe('playing')
    expect(starsOf(s)).toBe(0)
  })

  it('formats a friendly duration', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(59.9)).toBe('0:59')
    expect(formatDuration(150)).toBe('2:30')
  })
})
