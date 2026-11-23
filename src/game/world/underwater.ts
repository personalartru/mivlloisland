import * as THREE from 'three'
import type { Physics } from '../../engine/physics'
import type { LevelLayout } from '../layout'
import { createUnderwaterState, bubbleMultiplierAt, updateUnderwaterState, type UnderwaterState } from '../underwater'
import { flat, glowSprite, gradientSky, groundTexture, rng } from './shared'

export class UnderwaterWorld {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn: THREE.Vector3
  private readonly resonators: THREE.Mesh[] = []
  private readonly lights: THREE.PointLight[] = []
  private readonly lanes: THREE.Mesh[] = []
  private readonly bubbles: THREE.Sprite[] = []
  private readonly jellyfish: THREE.Group[] = []
  private readonly state: UnderwaterState
  private readonly beacon: THREE.Group
  private readonly mechanicEvents: Array<'resonator' | 'beacon'> = []
  private time = 0

  constructor(private readonly physics: Physics, shadowMapSize: number, private readonly layout: LevelLayout) {
    this.spawn = layout.spawn.clone()
    this.state = createUnderwaterState(layout.underwater!.resonators.length)
    const random = rng(layout.seed)
    this.scene.background = new THREE.Color('#071d36')
    this.scene.fog = new THREE.Fog('#0b3652', 42, 150)
    this.scene.add(gradientSky({ top: '#031226', middle: '#0b4261', horizon: '#3bb4be', sunDir: new THREE.Vector3(-.3, .8, -.4), sunColor: '#a8fff0', sunStrength: .55 }))
    this.scene.add(new THREE.HemisphereLight('#7ee7e6', '#071d36', 1.2))
    this.sun = new THREE.DirectionalLight('#c4fff2', 1.7)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.scene.add(this.sun, this.sun.target)
    this.addSeabed(random)
    this.addCoralGardens(random)
    this.addRuins()
    this.beacon = this.addBeacon()
    this.addResonators()
    this.addBubbleLanes()
    this.addKelp(random)
    this.addJellyfish(random)
    this.addBoundary(random)
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt
    this.sun.position.set(focus.x + 20, focus.y + 35, focus.z + 15)
    this.sun.target.position.copy(focus)
    this.beacon.rotation.y += dt * (this.state.beaconActive ? 1.1 : .08)
    for (const [i, bubble] of this.bubbles.entries()) {
      bubble.position.y += dt * (.28 + (i % 3) * .06)
      ;(bubble.material as THREE.SpriteMaterial).opacity = .18 + Math.sin(this.time * 2 + i) * .08
      if (bubble.position.y > 7) bubble.position.y = 1
    }
    for (const [i, jelly] of this.jellyfish.entries()) {
      jelly.position.y += Math.sin(this.time * 1.3 + i) * dt * .12
      jelly.rotation.y += dt * (i % 2 ? .2 : -.2)
    }
    for (const [i, light] of this.lights.entries()) light.intensity = this.state.resonators[i] ? 1.35 + Math.sin(this.time * 2 + i) * .15 : .08
  }

  setLanterns(done: number): void { for (let i = 0; i < this.lights.length; i++) this.lights[i].intensity = i < done ? 1.35 : .08 }
  resetMechanics(): void { this.state.resonators.fill(false); this.state.beaconActive = false; this.mechanicEvents.length = 0 }
  updateMechanics(position: THREE.Vector3): void {
    const before = this.state.resonators.slice()
    const wasBeacon = this.state.beaconActive
    const next = updateUnderwaterState(this.state, position, this.layout.underwater!)
    this.state.resonators = next.resonators
    this.state.beaconActive = next.beaconActive
    if (next.resonators.some((on, i) => on && !before[i])) this.mechanicEvents.push('resonator')
    if (next.beaconActive && !wasBeacon) this.mechanicEvents.push('beacon')
    for (const [i, resonator] of this.resonators.entries()) {
      const on = this.state.resonators[i]
      const material = resonator.material as THREE.MeshStandardMaterial
      material.color.set(on ? '#ffe6a8' : '#426a83')
      material.emissiveIntensity = on ? 2.3 : .15
    }
  }
  consumeMechanicEvents(): Array<'resonator' | 'beacon'> { return this.mechanicEvents.splice(0) }
  movementMultiplierAt(position: THREE.Vector3): number { return bubbleMultiplierAt(position, this.layout.underwater!) }

  private addSeabed(random: () => number): void {
    const r = this.layout.radius
    const tex = groundTexture('#0c5368', ['#08364f', '#13727b', '#0a2b46'], ['rgba(105,255,218,.3)', 'rgba(126,193,255,.25)'], this.layout.seed)
    tex.repeat.set(4, 4)
    const top = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, metalness: .05 }))
    top.rotation.x = -Math.PI / 2; top.position.y = .02; top.receiveShadow = true
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .9, 5, 72), flat(new THREE.Color('#06263e')))
    body.position.y = -2.5
    this.scene.add(top, body)
    this.physics.addStaticCylinder(new THREE.Vector3(0, -2.5, 0), r, 5)
    for (let i = 0; i < 24; i++) {
      const a = random() * Math.PI * 2; const d = 3 + random() * 25
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(.16 + random() * .22, 0), flat(new THREE.Color(i % 2 ? '#4b8e98' : '#9d7892')))
      pebble.position.set(Math.cos(a) * d, .15, Math.sin(a) * d); pebble.rotation.y = random() * 4; this.scene.add(pebble)
    }
  }

  private addCoralGardens(random: () => number): void {
    const gardenSpots = [
      [-16, 5], [-11, 14], [-3, 19], [8, 15], [17, 9], [18, -5], [10, -15], [-4, -19], [-16, -13], [-21, -3],
    ]
    const colors = ['#ff887b', '#ffb36b', '#d59cff', '#63e0cf']
    for (const [i, [x, z]] of gardenSpots.entries()) {
      const g = new THREE.Group()
      for (let branch = 0; branch < 5; branch++) {
        const h = .7 + random() * 1.2
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.07, .14, h, 6), flat(new THREE.Color(colors[(i + branch) % colors.length])))
        stem.position.set((branch - 2) * .22, h / 2, (random() - .5) * .35)
        stem.rotation.z = (branch - 2) * .16
        g.add(stem)
      }
      const fan = new THREE.Mesh(new THREE.TorusGeometry(.62, .06, 6, 16, Math.PI), flat(new THREE.Color(colors[(i + 1) % colors.length])))
      fan.position.set(0, 1.05, .12); fan.rotation.x = Math.PI / 2; fan.rotation.z = random() * .6; g.add(fan)
      g.position.set(x, .04, z); g.rotation.y = random() * 4; g.scale.setScalar(.75 + random() * .45); this.scene.add(g)
      const mote = glowSprite(colors[i % colors.length], .45, .25); mote.position.set(x, 1.8, z); this.scene.add(mote)
    }
  }

  private addRuins(): void {
    const stone = flat(new THREE.Color('#24647a'))
    for (const [x, z, rot] of [[-20, 14, .2], [20, 13, -.3], [20, -15, .5] as [number, number, number]]) {
      const arch = new THREE.Group()
      for (const side of [-1, 1]) { const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.42, .55, 3.2, 7), stone); pillar.position.set(side * 1.5, 1.6, 0); arch.add(pillar) }
      const lintel = new THREE.Mesh(new THREE.TorusGeometry(1.5, .42, 7, 14, Math.PI), stone); lintel.position.y = 3.1; lintel.rotation.z = Math.PI; arch.add(lintel)
      arch.position.set(x, .05, z); arch.rotation.y = rot; arch.castShadow = true; this.scene.add(arch)
    }
  }

  private addBeacon(): THREE.Group {
    const at = this.layout.landmark; const g = new THREE.Group(); g.position.copy(at)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.7, .5, 16), flat(new THREE.Color('#194a63'))); base.position.y = .25; g.add(base)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(.65, .9, 4.8, 10), flat(new THREE.Color('#63c8c6'))); tower.position.y = 2.6; g.add(tower)
    const glow = glowSprite('#b5fff0', 1.8, 1); glow.position.y = 5.4; g.add(glow)
    this.scene.add(g); this.physics.addStaticCylinder(new THREE.Vector3(at.x, 2, at.z), 2.3, 4); return g
  }
  private addResonators(): void { for (const at of this.layout.underwater!.resonators) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.05, .17, 8, 16), new THREE.MeshStandardMaterial({ color: '#426a83', emissive: '#ffe6a8', emissiveIntensity: .15, metalness: .25, roughness: .35 })); r.position.set(at.x, .65, at.z); r.rotation.x = Math.PI / 2; this.scene.add(r); this.resonators.push(r); const l = new THREE.PointLight('#ffe6a8', .08, 5); l.position.set(at.x, 1.4, at.z); this.scene.add(l); this.lights.push(l); this.physics.addStaticCylinder(new THREE.Vector3(at.x, .5, at.z), 1.2, .7) } }
  private addBubbleLanes(): void { for (const lane of this.layout.underwater!.bubbleLanes) { const ring = new THREE.Mesh(new THREE.RingGeometry(lane.radius * .5, lane.radius, 16), new THREE.MeshBasicMaterial({ color: '#81e7ff', transparent: true, opacity: .58, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(lane.center.x, .08, lane.center.z); this.scene.add(ring); this.lanes.push(ring) } }
  private addKelp(random: () => number): void { for (let i = 0; i < 28; i++) { const a = random() * Math.PI * 2; const d = 4 + random() * 22; const x = Math.cos(a) * d; const z = Math.sin(a) * d; const g = new THREE.Group(); const stem = new THREE.Mesh(new THREE.CapsuleGeometry(.08, .9 + random() * 1.4, 4, 7), flat(new THREE.Color(i % 2 ? '#2ca87f' : '#42c5a5'))); stem.position.y = .7; g.add(stem); for (let leaf = 0; leaf < 2; leaf++) { const blade = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .55, 4, 6), flat(new THREE.Color('#67d6a0'))); blade.position.set(leaf ? .18 : -.18, .9 + leaf * .2, 0); blade.rotation.z = leaf ? -.35 : .35; g.add(blade) } g.position.set(x, 0, z); g.rotation.z = (random() - .5) * .3; this.scene.add(g) } }
  private addJellyfish(random: () => number): void { for (let i = 0; i < 8; i++) { const g = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cf9cff', transparent: true, opacity: .72, emissive: '#a76cff', emissiveIntensity: .45 })); g.add(dome); for (let t = 0; t < 4; t++) { const tent = new THREE.Mesh(new THREE.CylinderGeometry(.025, .045, .9, 5), flat(new THREE.Color('#8ff1e5'))); tent.position.set((t - 1.5) * .18, -.4, 0); g.add(tent) } g.position.set(-22 + random() * 44, 3 + random() * 8, -20 + random() * 40); this.scene.add(g); this.jellyfish.push(g) } }
  private addBoundary(random: () => number): void { const n = 64; const r = this.layout.playableRadius + 1; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const x = Math.cos(a) * r; const z = Math.sin(a) * r; this.physics.addStaticBox(new THREE.Vector3(x, 2.5, z), new THREE.Vector3(.6, 5, 3.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)); if (i % 2 === 0) { const b = glowSprite('#81e7ff', .3 + random() * .25, .18); b.position.set(x, 1 + random() * 2, z); this.scene.add(b); this.bubbles.push(b) } } for (let i = 0; i < 24; i++) { const b = glowSprite('#d5f9ff', .18 + random() * .2, .2); b.position.set(-24 + random() * 48, 1 + random() * 5, -24 + random() * 48); this.scene.add(b); this.bubbles.push(b) } }
}
