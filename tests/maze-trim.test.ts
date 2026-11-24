import * as THREE from 'three'
import { expect, it } from 'vitest'
import type { Physics } from '../src/engine/physics'
import { addMaze } from '../src/game/world/shared'

it('uses a solid maze cap raised above the wall top', () => {
  const scene = new THREE.Scene()
  const physics = { addStaticBox: () => undefined } as unknown as Physics
  addMaze(scene, physics, { center: new THREE.Vector3(), cellSize: 1, grid: ['.'] }, '#403862', '#82e8f2')

  const caps = scene.children.filter((object): object is THREE.Mesh<THREE.BoxGeometry> =>
    object instanceof THREE.Mesh && object.geometry instanceof THREE.BoxGeometry && object.geometry.parameters.height === .12,
  )
  expect(caps).toHaveLength(2)
  for (const cap of caps) {
    expect((cap.material as THREE.MeshStandardMaterial).map).toBeNull()
    expect(cap.position.y + cap.geometry.parameters.height / 2).toBeGreaterThan(2.6)
  }
})
