import * as THREE from 'three'
import type { Physics } from '../../engine/physics'
import type { LevelLayout } from '../layout'
import { flat, rng } from './shared'
import type { WorldView } from '../world'

export class SummitWorld implements WorldView {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn: THREE.Vector3
  private time = 0
  private readonly crystals: THREE.Mesh[] = []

  constructor(private readonly physics: Physics, shadowMapSize: number, private readonly layout: LevelLayout) {
    this.spawn = layout.spawn.clone()
    const summit = layout.summit!
    this.scene.background = new THREE.Color('#17143d')
    this.scene.fog = new THREE.Fog('#17143d', 55, 150)
    this.scene.add(new THREE.HemisphereLight('#b9d8ff', '#241b4f', 1.25))
    this.sun = new THREE.DirectionalLight('#ffe0ba', 2.4); this.sun.castShadow = true; this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.scene.add(this.sun, this.sun.target)
    for (const platform of summit.platforms) {
      const [x, y, z] = [platform.size.x, platform.size.y, platform.size.z]
      const top = new THREE.Mesh(new THREE.BoxGeometry(x * 2, y, z * 2), flat(new THREE.Color('#41356f')))
      top.position.set(platform.center.x, platform.center.y, platform.center.z)
      top.castShadow = true; top.receiveShadow = true; this.scene.add(top)
      this.physics.addStaticBox(platform.center, new THREE.Vector3(x * 2, y, z * 2))
    }
    this.addHillsAndRocks()
    this.addDistantPeaks()
    this.addSkyRibbons()
    this.addCrystals()
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt; this.sun.position.set(focus.x + 18, focus.y + 34, focus.z + 14); this.sun.target.position.copy(focus)
    for (const [i, crystal] of this.crystals.entries()) { crystal.rotation.y += dt * (.4 + i * .02); crystal.position.y += Math.sin(this.time * 1.3 + i) * .0015 }
  }
  setLanterns(): void {}
  movementMultiplierAt(): number { return 1 }
  resetMechanics(): void {}
  updateMechanics(): void {}
  consumeMechanicEvents(): Array<'plate' | 'motor' | 'resonator' | 'beacon'> { return [] }

  private addHillsAndRocks(): void {
    const random = rng(this.layout.seed)
    const colors = ['#6650a8', '#3f9fbe', '#48b58f', '#d86882', '#a85ac4']
    for (let i = 0; i < 12; i++) {
      const a = random() * Math.PI * 2; const d = 8 + random() * 19
      const radius = 1.2 + random() * 1.5; const height = .8 + random() * 1.2
      const hill = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), flat(new THREE.Color(colors[i % colors.length])))
      hill.position.set(Math.cos(a) * d, .3 + height / 2, Math.sin(a) * d)
      hill.rotation.y = random() * 4; hill.castShadow = true; hill.receiveShadow = true; this.scene.add(hill)
      if (i < 8) {
        const stoneSize = .45 + random() * .5
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(stoneSize, 0), flat(new THREE.Color(i % 2 ? '#8e7bbf' : '#b26b91')))
        stone.position.set(hill.position.x + (random() - .5) * 2.5, .3 + stoneSize * .86, hill.position.z + (random() - .5) * 2.5)
        stone.rotation.set(0, random() * Math.PI * 2, 0); stone.castShadow = true; stone.receiveShadow = true; this.scene.add(stone)
      }
    }
  }
  private addDistantPeaks(): void {
    const random = rng(this.layout.seed + 41)
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + .12
      const distance = 26 + random() * 5
      const height = 3.5 + random() * 3.5
      const peak = new THREE.Mesh(new THREE.ConeGeometry(2.8 + random() * 1.8, height, 6), flat(new THREE.Color(i % 2 ? '#30265f' : '#5b3f82')))
      peak.position.set(Math.cos(angle) * distance, .3 + height / 2, Math.sin(angle) * distance)
      peak.rotation.y = random() * 4; peak.castShadow = true; peak.receiveShadow = true; this.scene.add(peak)
    }
  }
  private addSkyRibbons(): void {
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(25 + i * 4, .12, 6, 80), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff82c8' : '#72e8ff', transparent: true, opacity: .32 }))
      ring.rotation.x = Math.PI / 2 + i * .08; ring.position.y = 8 + i * 4; this.scene.add(ring)
    }
  }
  private addCrystals(): void {
    const spots = this.layout.itemSpots.rune ?? []
    for (const [i, spot] of spots.entries()) {
      const size = .35 + i * .03
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(size), new THREE.MeshStandardMaterial({ color: '#7ce9e1', emissive: '#46dbe1', emissiveIntensity: 1.2, transparent: true, opacity: .84 }))
      crystal.position.set(spot.x + .7, .3 + size, spot.z - .7); this.scene.add(crystal); this.crystals.push(crystal)
    }
  }
}
