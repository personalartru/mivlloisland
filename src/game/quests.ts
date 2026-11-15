/** Content definitions for the four island tasks and the collectible kinds they need. */

export type ItemKind = 'berry' | 'crystal' | 'mushroom' | 'star'
export type QuestId = 'grandma' | 'fairy' | 'mushroom' | 'cat'

export type ItemDef = {
  nameKey: string
  /** Model key used by the asset table. */
  model: ItemKind
  color: string
  glow: string
  height: number
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

export const ITEM_KINDS: ItemKind[] = ['berry', 'crystal', 'mushroom', 'star']

export const ITEMS: Record<ItemKind, ItemDef> = {
  berry: { nameKey: 'item.berry', model: 'berry', color: '#ff5a6e', glow: '#ff9aa8', height: 0.62 },
  crystal: { nameKey: 'item.crystal', model: 'crystal', color: '#66d9ff', glow: '#b8f3ff', height: 0.78 },
  mushroom: { nameKey: 'item.mushroom', model: 'mushroom', color: '#ff8a5c', glow: '#ffc9a8', height: 0.58 },
  star: { nameKey: 'item.star', model: 'star', color: '#ffd35c', glow: '#fff0a8', height: 0.66 },
}

export const QUESTS: QuestDef[] = [
  {
    id: 'grandma', item: 'berry', need: 5, accent: '#ff8a5c',
    nameKey: 'quest.grandma.name', titleKey: 'quest.grandma.title', introKey: 'quest.grandma.intro',
    progressKey: 'quest.grandma.progress', readyKey: 'quest.grandma.ready', thanksKey: 'quest.grandma.thanks', doneKey: 'quest.grandma.done',
  },
  {
    id: 'fairy', item: 'crystal', need: 4, accent: '#7cc7ff',
    nameKey: 'quest.fairy.name', titleKey: 'quest.fairy.title', introKey: 'quest.fairy.intro',
    progressKey: 'quest.fairy.progress', readyKey: 'quest.fairy.ready', thanksKey: 'quest.fairy.thanks', doneKey: 'quest.fairy.done',
  },
  {
    id: 'mushroom', item: 'mushroom', need: 4, accent: '#ff9a6b',
    nameKey: 'quest.mushroom.name', titleKey: 'quest.mushroom.title', introKey: 'quest.mushroom.intro',
    progressKey: 'quest.mushroom.progress', readyKey: 'quest.mushroom.ready', thanksKey: 'quest.mushroom.thanks', doneKey: 'quest.mushroom.done',
  },
  {
    id: 'cat', item: 'star', need: 3, accent: '#ffc94a',
    nameKey: 'quest.cat.name', titleKey: 'quest.cat.title', introKey: 'quest.cat.intro',
    progressKey: 'quest.cat.progress', readyKey: 'quest.cat.ready', thanksKey: 'quest.cat.thanks', doneKey: 'quest.cat.done',
  },
]

export const questById = new Map(QUESTS.map(q => [q.id, q]))

export function questForItem(item: ItemKind): QuestDef {
  return QUESTS.find(q => q.item === item) ?? QUESTS[0]
}

export const TOTAL_ITEMS = QUESTS.reduce((n, q) => n + q.need, 0)
