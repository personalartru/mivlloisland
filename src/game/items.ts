import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { instantiate } from './models'
import { ITEMS, ITEM_KINDS, type ItemKind } from './quests'
import { haloTexture } from './textures'

type Item = {
  kind: ItemKind
  home: THREE.Vector3
  root: THREE.Group
  spin: THREE.Object3D
  halo: THREE.Sprite
  taken: boolean
  phase: number
}

/**
 * Collectible wonders scattered around the island. Pickup is a cheap distance check against the
 * player each fixed step; the item stays in the backpack after it is picked up.
 */
export class Items {
  readonly group = new THREE.Group()
  private readonly items: Item[] = []
  private time = 0

  constructor(spots: Record<ItemKind, readonly THREE.Vector3[]>, models: Record<ItemKind, GLTF>) {
    const halo = haloTexture()
    for (const kind of ITEM_KINDS) {
      const def = ITEMS[kind]
      for (const [i, spot] of spots[kind].entries()) {
        const root = new THREE.Group()
        const spin = instantiate(models[kind], { height: def.height })
        spin.rotation.y = i * 1.3
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: halo, color: def.glow, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
        }))
        glow.scale.setScalar(kind === 'crystal' ? 2.3 : 1.8)
        root.add(glow, spin)
        root.position.copy(spot)
        this.group.add(root)
        this.items.push({ kind, home: spot.clone(), root, spin, halo: glow, taken: false, phase: i * 1.7 + kind.length })
      }
    }
  }

  get total(): number {
    return this.items.length
  }

  /** Items touched by the player's capsule this step. */
  collect(player: THREE.Vector3, radius: number): Array<{ kind: ItemKind; at: THREE.Vector3 }> {
    const got: Array<{ kind: ItemKind; at: THREE.Vector3 }> = []
    const r2 = radius * radius
    for (const item of this.items) {
      if (item.taken) continue
      if (item.home.distanceToSquared(player) < r2) {
        item.taken = true
        item.root.visible = false
        got.push({ kind: item.kind, at: item.home.clone() })
      }
    }
    return got
  }

  remaining(kind: ItemKind): THREE.Vector3[] {
    return this.items.filter(item => item.kind === kind && !item.taken).map(item => item.home)
  }

  nearest(kind: ItemKind, from: THREE.Vector3): THREE.Vector3 | undefined {
    let best: THREE.Vector3 | undefined
    let bestD = Infinity
    for (const item of this.items) {
      if (item.kind !== kind || item.taken) continue
      const d = item.home.distanceToSquared(from)
      if (d < bestD) {
        bestD = d
        best = item.home
      }
    }
    return best
  }

  reset(): void {
    for (const item of this.items) {
      item.taken = false
      item.root.visible = true
    }
  }

  animate(frameSeconds: number): void {
    this.time += frameSeconds
    for (const item of this.items) {
      if (item.taken) continue
      item.root.position.y = item.home.y + Math.sin(this.time * 2 + item.phase) * 0.12
      item.spin.rotation.y += frameSeconds * 1.4
      const pulse = 1 + Math.sin(this.time * 3.4 + item.phase) * 0.09
      item.halo.scale.setScalar((item.kind === 'crystal' ? 2.3 : 1.8) * pulse)
    }
  }
}
