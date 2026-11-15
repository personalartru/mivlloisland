import { CONFIG } from './config'
import { QUESTS, TOTAL_ITEMS, type ItemKind, type QuestId } from './quests'

/**
 * Pure journey rules: inventory, quest progress, score and the final celebration. No three.js,
 * no Rapier, no DOM — the scene reports events and reads the resulting state, and unit tests
 * cover every rule here. There is deliberately no losing state.
 */
export type QuestStatus = 'available' | 'active' | 'done'
export type JourneyPhase = 'playing' | 'won'

export type JourneyState = {
  unranked: boolean
  phase: JourneyPhase
  inventory: Record<ItemKind, number>
  quests: Record<QuestId, QuestStatus>
  elapsed: number
  totalCollected: number
  score: number
}

function emptyInventory(): Record<ItemKind, number> {
  return { berry: 0, crystal: 0, mushroom: 0, star: 0 }
}

function emptyQuests(): Record<QuestId, QuestStatus> {
  return { grandma: 'available', fairy: 'available', mushroom: 'available', cat: 'available' }
}

export function completedCount(s: JourneyState): number {
  return QUESTS.filter(q => s.quests[q.id] === 'done').length
}

export function allDone(s: JourneyState): boolean {
  return completedCount(s) === QUESTS.length
}

export function scoreOf(s: JourneyState, rules = CONFIG): number {
  return s.totalCollected * rules.quest.itemPoints + completedCount(s) * rules.quest.questPoints + (allDone(s) ? rules.quest.finishBonus : 0)
}

function rescored(s: JourneyState, rules = CONFIG): JourneyState {
  return { ...s, score: scoreOf(s, rules) }
}

export function createJourney(rules = CONFIG): JourneyState {
  const base: JourneyState = {
    unranked: false,
    phase: 'playing',
    inventory: emptyInventory(),
    quests: emptyQuests(),
    elapsed: 0,
    totalCollected: 0,
    score: 0,
  }
  return rescored(base, rules)
}

export function tick(s: JourneyState, dt: number): JourneyState {
  if (s.phase !== 'playing' || dt <= 0) return s
  return { ...s, elapsed: s.elapsed + dt }
}

/** A collectible was touched. The item stays in the backpack so children can see their collection. */
export function pickup(s: JourneyState, kind: ItemKind, rules = CONFIG): { state: JourneyState; gained: number } {
  if (s.phase !== 'playing') return { state: s, gained: 0 }
  const next: JourneyState = {
    ...s,
    inventory: { ...s.inventory, [kind]: s.inventory[kind] + 1 },
    totalCollected: Math.min(TOTAL_ITEMS, s.totalCollected + 1),
  }
  return { state: rescored(next, rules), gained: 1 }
}

export function acceptQuest(s: JourneyState, id: QuestId): { state: JourneyState; accepted: boolean } {
  if (s.phase !== 'playing' || s.quests[id] !== 'available') return { state: s, accepted: false }
  return { state: { ...s, quests: { ...s.quests, [id]: 'active' } }, accepted: true }
}

export function missingFor(s: JourneyState, id: QuestId): number {
  const quest = QUESTS.find(q => q.id === id)
  if (!quest) return 0
  return Math.max(0, quest.need - s.inventory[quest.item])
}

export function isReady(s: JourneyState, id: QuestId): boolean {
  return s.quests[id] === 'active' && missingFor(s, id) === 0
}

/** Hand collected items to a resident. Only an active, fully supplied quest can be turned in. */
export function turnIn(s: JourneyState, id: QuestId, rules = CONFIG): { state: JourneyState; completed: boolean } {
  if (s.phase !== 'playing' || !isReady(s, id)) return { state: s, completed: false }
  const next: JourneyState = { ...s, quests: { ...s.quests, [id]: 'done' } }
  const done = allDone(next)
  return { state: rescored({ ...next, phase: done ? 'won' : 'playing' }, rules), completed: true }
}

/** Celebration stars: completing every task always earns all three. */
export function starsOf(s: JourneyState): number {
  return s.phase === 'won' ? 3 : 0
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
