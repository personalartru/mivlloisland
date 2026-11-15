import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiate, type ModelPack } from './models'
import { cosmicItem, cosmicNpcVisual } from './cosmic'
import { clockworkItem, clockworkNpcVisual } from './clockwork-visuals'
import { itemDef, type IslandItemKind, type IslandQuestId, type ItemKind, type LevelContent, type QuestId } from './content'
import type { NpcVisual } from './visual-types'

const ISLAND_HEIGHTS: Record<IslandQuestId, number> = { grandma: 1.55, fairy: 1.7, mushroom: 1.45, cat: 1.2 }

const islandNpc = (models: ModelPack, id: IslandQuestId): NpcVisual => ({
  height: ISLAND_HEIGHTS[id],
  build: () => instantiate(models.npcs[id], { height: ISLAND_HEIGHTS[id] }),
})

/** How every resident of a level is drawn, keyed by task id. */
export function npcVisuals(content: LevelContent, models: ModelPack): Partial<Record<QuestId, NpcVisual>> {
  const visuals: Partial<Record<QuestId, NpcVisual>> = {}
  for (const quest of content.quests) {
    const visual = content.id === 'island'
      ? islandNpc(models, quest.id as IslandQuestId)
      : content.id === 'planet' ? cosmicNpcVisual(quest.id) : clockworkNpcVisual(quest.id)
    if (visual) visuals[quest.id] = visual
  }
  return visuals
}

/** Factory for collectible models of one level. */
export function itemFactory(content: LevelContent, models: ModelPack): (kind: ItemKind) => THREE.Object3D {
  if (content.id === 'island') {
    return kind => instantiate(models.items[kind as IslandItemKind], { height: itemDef(content, kind).height })
  }
  if (content.id === 'clockwork') return kind => clockworkItem(kind)
  return kind => cosmicItem(kind) ?? new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: '#ffffff' }))
}

export type { GLTF }
