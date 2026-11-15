import type { LevelId } from './levels'
import { ISLAND_LAYOUT, PLANET_LAYOUT, CLOCKWORK_LAYOUT, UNDERWATER_LAYOUT, type LevelLayout } from './layout'

/** Every collectible kind in the whole game. Each level uses its own subset. */
export type ItemKind =
  | 'berry' | 'crystal' | 'mushroom' | 'star'
  | 'stardust' | 'seed' | 'nebula' | 'shard' | 'spark' | 'lunar'
  | 'cog' | 'bolt' | 'spring' | 'valve' | 'gear'
  | 'pearl' | 'coral' | 'shell' | 'kelp' | 'bubble'

/** Every friendly character with a task. Each level uses its own subset. */
export type QuestId =
  | 'grandma' | 'fairy' | 'mushroom' | 'cat'
  | 'lumo' | 'bip' | 'whale' | 'keeper' | 'comet' | 'lunatic'
  | 'geara' | 'piston' | 'spring' | 'copper' | 'tick'
  | 'coralina' | 'octo' | 'splash' | 'pearl' | 'fin'

export type IslandItemKind = Extract<ItemKind, 'berry' | 'crystal' | 'mushroom' | 'star'>
export type IslandQuestId = Extract<QuestId, 'grandma' | 'fairy' | 'mushroom' | 'cat'>

export type ItemDef = {
  nameKey: string
  color: string
  glow: string
  height: number
  /** Size of the soft glow sprite behind the collectible. */
  halo: number
}

export type QuestDef = {
  id: QuestId
  item: ItemKind
  need: number
  nameKey: string
  titleKey: string
  introKey: string
  progressKey: string
  readyKey: string
  thanksKey: string
  doneKey: string
  accent: string
}

export type LevelContent = {
  id: LevelId
  layout: LevelLayout
  itemKinds: ItemKind[]
  items: Partial<Record<ItemKind, ItemDef>>
  quests: QuestDef[]
  totalItems: number
  /** Per-level HUD copy so the island never talks about the planet and vice versa. */
  noTasksKey: string
  collectHintKey: string
  resultsWonKey: string
  resultsThanksKey: string
}

const quest = (
  id: QuestId,
  item: ItemKind,
  need: number,
  accent: string,
): QuestDef => ({
  id, item, need, accent,
  nameKey: `quest.${id}.name`, titleKey: `quest.${id}.title`, introKey: `quest.${id}.intro`,
  progressKey: `quest.${id}.progress`, readyKey: `quest.${id}.ready`, thanksKey: `quest.${id}.thanks`, doneKey: `quest.${id}.done`,
})

export const ISLAND_CONTENT: LevelContent = {
  id: 'island',
  layout: ISLAND_LAYOUT,
  itemKinds: ['berry', 'crystal', 'mushroom', 'star'],
  items: {
    berry: { nameKey: 'item.berry', color: '#ff5a6e', glow: '#ff9aa8', height: 0.68, halo: 1.05 },
    crystal: { nameKey: 'item.crystal', color: '#66d9ff', glow: '#b8f3ff', height: 0.8, halo: 1.6 },
    mushroom: { nameKey: 'item.mushroom', color: '#ff8a5c', glow: '#ffc9a8', height: 0.6, halo: 1.25 },
    star: { nameKey: 'item.star', color: '#ffd35c', glow: '#fff0a8', height: 0.68, halo: 1.35 },
  },
  quests: [
    quest('grandma', 'berry', 5, '#ff8a5c'),
    quest('fairy', 'crystal', 4, '#7cc7ff'),
    quest('mushroom', 'mushroom', 4, '#ff9a6b'),
    quest('cat', 'star', 3, '#ffc94a'),
  ],
  totalItems: 16,
  noTasksKey: 'hud.noTasks.island',
  collectHintKey: 'hint.collect.island',
  resultsWonKey: 'results.island.won',
  resultsThanksKey: 'results.island.thanks',
}

/**
 * Планета Звёздная. Six cosmic friends, six new kinds of wonders and more to do than on the
 * island, with the same no-fail rules: walk, talk, collect, celebrate.
 */
export const PLANET_CONTENT: LevelContent = {
  id: 'planet',
  layout: PLANET_LAYOUT,
  itemKinds: ['stardust', 'seed', 'nebula', 'shard', 'spark', 'lunar'],
  items: {
    stardust: { nameKey: 'item.stardust', color: '#ffe07a', glow: '#fff3b0', height: 0.62, halo: 1.1 },
    seed: { nameKey: 'item.seed', color: '#7ef0d0', glow: '#b6ffe9', height: 0.68, halo: 1.05 },
    nebula: { nameKey: 'item.nebula', color: '#ff9ae6', glow: '#ffd0f6', height: 0.68, halo: 1.2 },
    shard: { nameKey: 'item.shard', color: '#9ad8ff', glow: '#d6f2ff', height: 0.78, halo: 1.1 },
    spark: { nameKey: 'item.spark', color: '#ffb35c', glow: '#ffd9a8', height: 0.64, halo: 1.15 },
    lunar: { nameKey: 'item.lunar', color: '#c9bfff', glow: '#efeaff', height: 0.66, halo: 1.1 },
  },
  quests: [
    quest('lumo', 'stardust', 5, '#8be9ff'),
    quest('bip', 'seed', 4, '#7ef0d0'),
    quest('whale', 'nebula', 3, '#b79cff'),
    quest('keeper', 'shard', 5, '#ff9ae6'),
    quest('comet', 'spark', 4, '#ffb35c'),
    quest('lunatic', 'lunar', 3, '#e8e6ff'),
  ],
  totalItems: 24,
  noTasksKey: 'hud.noTasks.planet',
  collectHintKey: 'hint.collect.planet',
  resultsWonKey: 'results.planet.won',
  resultsThanksKey: 'results.planet.thanks',
}


export const CLOCKWORK_CONTENT: LevelContent = {
  id: 'clockwork', layout: CLOCKWORK_LAYOUT, itemKinds: ['cog', 'bolt', 'spring', 'valve', 'gear'],
  items: {
    cog: { nameKey: 'item.cog', color: '#f2b35c', glow: '#ffe0a0', height: .62, halo: 1.15 },
    bolt: { nameKey: 'item.bolt', color: '#7fe0d2', glow: '#b9fff4', height: .65, halo: 1.05 },
    spring: { nameKey: 'item.spring', color: '#f08a68', glow: '#ffc0a8', height: .72, halo: 1.12 },
    valve: { nameKey: 'item.valve', color: '#a7a9bd', glow: '#e5e6ff', height: .58, halo: 1.08 },
    gear: { nameKey: 'item.gear', color: '#ffd35c', glow: '#fff0a8', height: .66, halo: 1.15 },
  },
  quests: [quest('geara', 'cog', 4, '#f2b35c'), quest('piston', 'bolt', 3, '#7fe0d2'), quest('spring', 'spring', 4, '#f08a68'), quest('copper', 'valve', 3, '#a7a9bd'), quest('tick', 'gear', 3, '#ffd35c')],
  totalItems: 17, noTasksKey: 'hud.noTasks.clockwork', collectHintKey: 'hint.collect.clockwork', resultsWonKey: 'results.clockwork.won', resultsThanksKey: 'results.clockwork.thanks',
}


export const UNDERWATER_CONTENT: LevelContent = {
  id: 'underwater', layout: UNDERWATER_LAYOUT, itemKinds: ['pearl', 'coral', 'shell', 'kelp', 'bubble'],
  items: {
    pearl: { nameKey: 'item.pearl', color: '#fff0c4', glow: '#fff9e8', height: .62, halo: 1.15 },
    coral: { nameKey: 'item.coral', color: '#ff887b', glow: '#ffc0b5', height: .72, halo: 1.12 },
    shell: { nameKey: 'item.shell', color: '#d9b3ff', glow: '#f0ddff', height: .66, halo: 1.12 },
    kelp: { nameKey: 'item.kelp', color: '#67d6a0', glow: '#b5ffe0', height: .9, halo: 1.05 },
    bubble: { nameKey: 'item.bubble', color: '#81e7ff', glow: '#d5f9ff', height: .62, halo: 1.25 },
  },
  quests: [quest('coralina','pearl',4,'#ffe8ad'), quest('octo','coral',3,'#ff8a7e'), quest('splash','shell',4,'#d5b2ff'), quest('pearl','kelp',3,'#6ed8a0'), quest('fin','bubble',3,'#81e7ff')],
  totalItems: 17, noTasksKey: 'hud.noTasks.underwater', collectHintKey: 'hint.collect.underwater', resultsWonKey: 'results.underwater.won', resultsThanksKey: 'results.underwater.thanks',
}

export const CONTENT: Record<LevelId, LevelContent> = {
  island: ISLAND_CONTENT,
  planet: PLANET_CONTENT,
  clockwork: CLOCKWORK_CONTENT,
  underwater: UNDERWATER_CONTENT,
}

export function contentFor(level: LevelId): LevelContent {
  return CONTENT[level]
}

export function itemDef(content: LevelContent, kind: ItemKind): ItemDef {
  const def = content.items[kind]
  if (!def) throw new Error(`item ${kind} is not part of level ${content.id}`)
  return def
}

export function questOf(content: LevelContent, id: QuestId): QuestDef | undefined {
  return content.quests.find(q => q.id === id)
}

export function questByItem(content: LevelContent, item: ItemKind): QuestDef | undefined {
  return content.quests.find(q => q.item === item)
}
