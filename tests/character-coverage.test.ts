import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CONTENT, ISLAND_CONTENT } from '../src/game/content'
import { npcVisuals } from '../src/game/visuals'
import { clockworkItem } from '../src/game/clockwork-visuals'
import { underwaterItem } from '../src/game/underwater-visuals'
import type { ModelPack } from '../src/game/models'

describe('character visuals', () => {
  it('builds a non-empty visual for every quest character in all five worlds', () => {
    const gltf = { scene: new THREE.Group(), animations: [] } as unknown as ModelPack['npcs'][keyof ModelPack['npcs']]
    gltf.scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()))
    const islandModels = { npcs: Object.fromEntries(ISLAND_CONTENT.quests.map(quest => [quest.id, gltf])) } as unknown as ModelPack
    for (const level of Object.values(CONTENT)) {
      const visuals = npcVisuals(level, islandModels)
      expect(Object.keys(visuals).sort()).toEqual(level.quests.map(quest => quest.id).sort())
      for (const quest of level.quests) {
        const object = visuals[quest.id]!.build()
        expect(object, `${level.id}/${quest.id} visual`).toBeInstanceOf(THREE.Object3D)
        let meshes = 0
        object.traverse(child => { if ((child as THREE.Mesh).isMesh) meshes += 1 })
        expect(meshes, `${level.id}/${quest.id} has visible geometry`).toBeGreaterThan(0)
      }
    }
  })

  it('gives cog six teeth and gear eight', () => {
    expect(clockworkItem('cog').children).toHaveLength(7)
    expect(clockworkItem('gear').children).toHaveLength(9)
  })

  it('builds the kelp collectible with a stem and two visible leaves', () => {
    expect(underwaterItem('kelp').children).toHaveLength(3)
  })
})
