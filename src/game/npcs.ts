import * as THREE from 'three'
import type { Physics } from '../engine/physics'
import { questOf, type LevelContent, type QuestId } from './content'
import type { JourneyState } from './rules'
import { questBubbleTexture } from './textures'
import type { NpcVisual } from './visual-types'

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
  bob: number
  hover: number
  tick?: NpcVisual['tick']
}

/**
 * The friendly residents of one level. They turn toward the player when he comes close, float
 * gently and show their task in a bubble above their head.
 */
export class Npcs {
  readonly group = new THREE.Group()
  private readonly npcs: Npc[] = []

  constructor(physics: Physics, private readonly content: LevelContent, visuals: Partial<Record<QuestId, NpcVisual>>) {
    for (const [i, quest] of content.quests.entries()) {
      const spot = content.layout.npcSpots[quest.id]
      const visual = visuals[quest.id]
      if (!spot || !visual) continue
      const root = new THREE.Group()
      root.position.copy(spot)
      const model = visual.build()
      model.position.y = visual.hover ?? 0
      const idleYaw = Math.atan2(content.layout.spawn.x - spot.x, content.layout.spawn.z - spot.z)
      root.rotation.y = idleYaw
      root.add(model)

      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
        map: questBubbleTexture('available', quest.item, 0, quest.need), transparent: true, depthWrite: false,
      }))
      bubble.scale.setScalar(0.78)
      bubble.position.y = visual.height + 0.62
      root.add(bubble)

      this.group.add(root)
      this.npcs.push({
        id: quest.id, root, visual: model, bubble, baseHeight: visual.height,
        phase: i * 1.4, idleYaw, bubbleKey: '',
        bob: visual.bob ?? 0.035, hover: visual.hover ?? 0, tick: visual.tick,
      })
      // Keep the invisible NPC obstacle on the same terrace as the visual. Summit NPCs
      // live above the base level; using a fixed y=0.7 made their colliders intersect floors.
      physics.addStaticCylinder(new THREE.Vector3(spot.x, spot.y + 0.7, spot.z), visual.collider ?? 0.45, 1.4)
    }
  }

  update(journey: JourneyState, player: THREE.Vector3, dt: number, time: number): void {
    for (const npc of this.npcs) {
      const quest = questOf(this.content, npc.id)
      if (!quest) continue
      const dx = player.x - npc.root.position.x
      const dz = player.z - npc.root.position.z
      const distance = Math.hypot(dx, dz)
      const targetYaw = distance < 8 ? Math.atan2(dx, dz) : npc.idleYaw
      npc.root.rotation.y = dampAngle(npc.root.rotation.y, targetYaw, 5, dt)
      npc.visual.position.y = npc.hover + Math.sin(time * 1.7 + npc.phase) * npc.bob
      npc.tick?.(npc.visual, time)
      npc.bubble.position.y = npc.baseHeight + 0.62 + Math.sin(time * 2.1 + npc.phase) * 0.06
      const pulse = 0.78 + Math.sin(time * 2.6 + npc.phase) * 0.035
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
        best = { id: npc.id, nameKey: questOf(this.content, npc.id)!.nameKey, position: position.clone(), distance }
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
