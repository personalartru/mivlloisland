import { CONFIG } from './config'
import type { ItemKind, LevelContent, QuestId } from './content'
import type { LevelId } from './levels'

/**
 * Pure journey rules: inventory, quest progress, score and the final celebration. No three.js,
 * no Rapier, no DOM — the scene reports events and reads the resulting state, and unit tests
 * cover every rule here. There is deliberately no losing state.
 */
export type QuestStatus = 'available' | 'active' | 'done'
export type JourneyPhase = 'playing' | 'won'

export type JourneyState = {
  level: LevelId
  unranked: boolean
  phase: JourneyPhase
  inventory: Record<ItemKind, number>
  quests: Record<QuestId, QuestStatus>
  elapsed: number
  totalCollected: number
  score: number
}

function emptyInventory(): Record<ItemKind, number> {
  return {
    berry: 0, crystal: 0, mushroom: 0, star: 0,
    stardust: 0, seed: 0, nebula: 0, shard: 0, spark: 0, lunar: 0,
    cog: 0, bolt: 0, spring: 0, valve: 0, gear: 0,
    pearl: 0, coral: 0, shell: 0, kelp: 0, bubble: 0,
  }
}

function emptyQuests(): Record<QuestId, QuestStatus> {
  return {
    grandma: 'available', fairy: 'available', mushroom: 'available', cat: 'available',
    lumo: 'available', bip: 'available', whale: 'available', keeper: 'available', comet: 'available', lunatic: 'available',
    geara: 'available', piston: 'available', spring: 'available', copper: 'available', tick: 'available',
    coralina: 'available', octo: 'available', splash: 'available', pearl: 'available', fin: 'available',
  }
}

export function completedCount(s: JourneyState, content: LevelContent): number {
  return content.quests.filter(q => s.quests[q.id] === 'done').length
}

export function allDone(s: JourneyState, content: LevelContent): boolean {
  return completedCount(s, content) === content.quests.length
}

export function scoreOf(s: JourneyState, content: LevelContent, rules = CONFIG): number {
  return s.totalCollected * rules.quest.itemPoints + completedCount(s, content) * rules.quest.questPoints + (allDone(s, content) ? rules.quest.finishBonus : 0)
}

function rescored(s: JourneyState, content: LevelContent, rules = CONFIG): JourneyState {
  return { ...s, score: scoreOf(s, content, rules) }
}

export function createJourney(content: LevelContent, rules = CONFIG): JourneyState {
  const base: JourneyState = {
    level: content.id,
    unranked: false,
    phase: 'playing',
    inventory: emptyInventory(),
    quests: emptyQuests(),
    elapsed: 0,
    totalCollected: 0,
    score: 0,
  }
  return rescored(base, content, rules)
}

export function tick(s: JourneyState, dt: number): JourneyState {
  if (s.phase !== 'playing' || dt <= 0) return s
  return { ...s, elapsed: s.elapsed + dt }
}

/** A collectible was touched. The item stays in the backpack so children can see their collection. */
export function pickup(s: JourneyState, kind: ItemKind, content: LevelContent, rules = CONFIG): { state: JourneyState; gained: number } {
  if (s.phase !== 'playing') return { state: s, gained: 0 }
  const next: JourneyState = {
    ...s,
    inventory: { ...s.inventory, [kind]: s.inventory[kind] + 1 },
    totalCollected: Math.min(content.totalItems, s.totalCollected + 1),
  }
  return { state: rescored(next, content, rules), gained: 1 }
}

export function acceptQuest(s: JourneyState, id: QuestId): { state: JourneyState; accepted: boolean } {
  if (s.phase !== 'playing' || s.quests[id] !== 'available') return { state: s, accepted: false }
  return { state: { ...s, quests: { ...s.quests, [id]: 'active' } }, accepted: true }
}

export function missingFor(s: JourneyState, id: QuestId, content: LevelContent): number {
  const quest = content.quests.find(q => q.id === id)
  if (!quest) return 0
  return Math.max(0, quest.need - s.inventory[quest.item])
}

export function isReady(s: JourneyState, id: QuestId, content: LevelContent): boolean {
  return s.quests[id] === 'active' && missingFor(s, id, content) === 0
}

/** Hand collected items to a resident. Only an active, fully supplied quest can be turned in. */
export function turnIn(s: JourneyState, id: QuestId, content: LevelContent, rules = CONFIG): { state: JourneyState; completed: boolean } {
  if (s.phase !== 'playing' || !isReady(s, id, content)) return { state: s, completed: false }
  const next: JourneyState = { ...s, quests: { ...s.quests, [id]: 'done' } }
  const done = allDone(next, content)
  return { state: rescored({ ...next, phase: done ? 'won' : 'playing' }, content, rules), completed: true }
}

/** Celebration stars: completing every task always earns all three. */
export function starsOf(s: JourneyState): number {
  return s.phase === 'won' ? 3 : 0
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
