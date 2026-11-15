import { describe, expect, it } from 'vitest'
import { CONFIG } from '../src/game/config'
import { QUESTS, TOTAL_ITEMS } from '../src/game/quests'
import {
  acceptQuest, allDone, completedCount, createJourney, formatDuration, isReady,
  missingFor, pickup, starsOf, tick, turnIn,
} from '../src/game/rules'

function completeAll() {
  let s = createJourney()
  for (const quest of QUESTS) {
    s = acceptQuest(s, quest.id).state
    for (let i = 0; i < quest.need; i += 1) s = pickup(s, quest.item).state
    s = turnIn(s, quest.id).state
  }
  return s
}

describe('journey rules', () => {
  it('starts a friendly journey with no tasks, no items and no losing state', () => {
    const s = createJourney()
    expect(s.phase).toBe('playing')
    expect(s.score).toBe(0)
    expect(s.totalCollected).toBe(0)
    expect(completedCount(s)).toBe(0)
    expect(Object.values(s.quests).every(v => v === 'available')).toBe(true)
    expect(s).not.toHaveProperty('lives')
    expect(s).not.toHaveProperty('timeLeft')
  })

  it('collects items into the backpack and scores every pickup', () => {
    let s = createJourney()
    const r = pickup(s, 'berry')
    s = r.state
    expect(r.gained).toBe(1)
    expect(s.inventory.berry).toBe(1)
    expect(s.totalCollected).toBe(1)
    expect(s.score).toBe(CONFIG.quest.itemPoints)
  })

  it('requires enough items before a resident accepts a task turn-in', () => {
    let s = acceptQuest(createJourney(), 'grandma').state
    expect(s.quests.grandma).toBe('active')
    expect(missingFor(s, 'grandma')).toBe(5)
    expect(isReady(s, 'grandma')).toBe(false)
    expect(turnIn(s, 'grandma').completed).toBe(false)
    for (let i = 0; i < 4; i += 1) s = pickup(s, 'berry').state
    expect(missingFor(s, 'grandma')).toBe(1)
    expect(turnIn(s, 'grandma').completed).toBe(false)
    s = pickup(s, 'berry').state
    expect(isReady(s, 'grandma')).toBe(true)
    const done = turnIn(s, 'grandma')
    expect(done.completed).toBe(true)
    expect(done.state.quests.grandma).toBe('done')
    expect(done.state.inventory.berry).toBe(5)
    expect(done.state.phase).toBe('playing')
  })

  it('does not accept the same task twice and keeps completed tasks completed', () => {
    let s = acceptQuest(createJourney(), 'fairy').state
    expect(acceptQuest(s, 'fairy').accepted).toBe(false)
    for (let i = 0; i < 4; i += 1) s = pickup(s, 'crystal').state
    s = turnIn(s, 'fairy').state
    expect(acceptQuest(s, 'fairy').accepted).toBe(false)
    expect(turnIn(s, 'fairy').completed).toBe(false)
  })

  it('celebrates only after all four residents are helped, with a fixed fair score', () => {
    let s = completeAll()
    expect(s.phase).toBe('won')
    expect(allDone(s)).toBe(true)
    expect(completedCount(s)).toBe(QUESTS.length)
    expect(s.totalCollected).toBe(TOTAL_ITEMS)
    expect(s.score).toBe(TOTAL_ITEMS * CONFIG.quest.itemPoints + QUESTS.length * CONFIG.quest.questPoints + CONFIG.quest.finishBonus)
    expect(starsOf(s)).toBe(3)
    expect(s.phase).not.toBe('lost')
  })

  it('freezes time and pickups after the celebration starts', () => {
    const won = completeAll()
    expect(tick(won, 10)).toBe(won)
    expect(pickup(won, 'star').gained).toBe(0)
  })

  it('counts the walk time until the celebration, without a time limit', () => {
    let s = tick(createJourney(), 12.5)
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
