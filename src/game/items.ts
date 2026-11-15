import * as THREE from 'three'
import { itemDef, type ItemKind, type LevelContent } from './content'
import { haloTexture } from './textures'

type Item = {
  kind: ItemKind
  home: THREE.Vector3
  root: THREE.Group
  spin: THREE.Object3D
  halo: THREE.Sprite
  haloScale: number
  taken: boolean
  phase: number
  tick?: (time: number) => void
}

/**
 * Collectible wonders scattered around a level. Pickup is a cheap distance check against the
 * player each fixed step; the item stays in the backpack after it is picked up.
 */
export class Items {
  readonly group = new THREE.Group()
  private readonly items: Item[] = []
  private time = 0

  constructor(private readonly content: LevelContent, build: (kind: ItemKind) => THREE.Object3D) {
    const halo = haloTexture()
    for (const kind of content.itemKinds) {
      const def = itemDef(content, kind)
      for (const [i, spot] of (content.layout.itemSpots[kind] ?? []).entries()) {
        const root = new THREE.Group()
        const spin = build(kind)
        spin.rotation.y = i * 1.3
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: halo, color: def.color, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending,
        }))
        glow.scale.setScalar(def.halo)
        root.add(glow, spin)
        root.position.copy(spot)
        this.group.add(root)
        this.items.push({
          kind, home: spot.clone(), root, spin, halo: glow, haloScale: def.halo, taken: false,
          phase: i * 1.7 + kind.length, tick: spin.userData.tick as ((time: number) => void) | undefined,
        })
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
      item.tick?.(this.time)
      const pulse = 1 + Math.sin(this.time * 3.4 + item.phase) * 0.09
      item.halo.scale.setScalar(item.haloScale * pulse)
    }
  }

  /** Ids of the item kinds this level uses, for HUD rendering. */
  get kinds(): ItemKind[] {
    return this.content.itemKinds
  }
}
