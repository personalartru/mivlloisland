import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Physics } from '../engine/physics'
import { instantiate } from './models'
import { QUESTS, questById, type QuestId } from './quests'
import type { JourneyState } from './rules'
import { questBubbleTexture } from './textures'
import { WORLD } from './world'

export type NpcInfo = { id: QuestId; nameKey: string; position: THREE.Vector3; distance: number }

type Npc = {
  id: QuestId
  root: THREE.Group
  visual: THREE.Group
  bubble: THREE.Sprite
  baseHeight: number
  phase: number
  idleYaw: number
  bubbleKey: string
}

const HEIGHTS: Record<QuestId, number> = { grandma: 1.55, fairy: 1.7, mushroom: 1.45, cat: 1.2 }

/** The four friendly residents. They turn toward Plyuhik when he comes close and show their task. */
export class Npcs {
  readonly group = new THREE.Group()
  private readonly npcs: Npc[] = []

  constructor(physics: Physics, models: Record<QuestId, GLTF>) {
    for (const [i, quest] of QUESTS.entries()) {
      const spot = WORLD.npcSpots[quest.id]
      const root = new THREE.Group()
      root.position.copy(spot)
      const visual = instantiate(models[quest.id], { height: HEIGHTS[quest.id] })
      const idleYaw = Math.atan2(WORLD.spawn.x - spot.x, WORLD.spawn.z - spot.z)
      root.rotation.y = idleYaw
      root.add(visual)

      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
        map: questBubbleTexture('available', quest.item, 0, quest.need), transparent: true, depthWrite: false,
      }))
      bubble.scale.setScalar(1.15)
      bubble.position.y = HEIGHTS[quest.id] + 0.75
      root.add(bubble)

      this.group.add(root)
      this.npcs.push({ id: quest.id, root, visual, bubble, baseHeight: HEIGHTS[quest.id], phase: i * 1.4, idleYaw, bubbleKey: '' })
      physics.addStaticCylinder(new THREE.Vector3(spot.x, 0.7, spot.z), 0.45, 1.4)
    }
  }

  update(journey: JourneyState, player: THREE.Vector3, dt: number, time: number): void {
    for (const npc of this.npcs) {
      const quest = questById.get(npc.id)!
      const dx = player.x - npc.root.position.x
      const dz = player.z - npc.root.position.z
      const distance = Math.hypot(dx, dz)
      const targetYaw = distance < 8 ? Math.atan2(dx, dz) : npc.idleYaw
      npc.root.rotation.y = dampAngle(npc.root.rotation.y, targetYaw, 5, dt)
      npc.visual.position.y = Math.sin(time * 1.7 + npc.phase) * 0.035
      npc.bubble.position.y = npc.baseHeight + 0.75 + Math.sin(time * 2.1 + npc.phase) * 0.07
      const pulse = 1.12 + Math.sin(time * 2.6 + npc.phase) * 0.05
      npc.bubble.scale.setScalar(pulse)

      const status = journey.quests[npc.id]
      const have = journey.inventory[quest.item]
      const key = `${status}:${have}:${quest.need}`
      if (key !== npc.bubbleKey) {
        npc.bubbleKey = key
        ;(npc.bubble.material as THREE.SpriteMaterial).map = questBubbleTexture(
          status === 'done' ? 'done' : status === 'active' ? 'active' : 'available',
          quest.item,
          have,
          quest.need,
        )
        ;(npc.bubble.material as THREE.SpriteMaterial).needsUpdate = true
      }
    }
  }

  nearest(pos: THREE.Vector3, radius: number): NpcInfo | null {
    let best: NpcInfo | null = null
    for (const npc of this.npcs) {
      const position = npc.root.position
      const distance = Math.hypot(position.x - pos.x, position.z - pos.z)
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { id: npc.id, nameKey: questById.get(npc.id)!.nameKey, position: position.clone(), distance }
      }
    }
    return best
  }

  positionOf(id: QuestId): THREE.Vector3 {
    return this.npcs.find(npc => npc.id === id)!.root.position.clone()
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
