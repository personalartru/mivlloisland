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
    const terraceColors = ['#6650a8', '#3f9fbe', '#48b58f', '#e0a34b', '#d86882', '#a85ac4']
    for (const [index, platform] of summit.platforms.entries()) {
      const [x, y, z] = [platform.size.x, platform.size.y, platform.size.z]
      const color = terraceColors[index % terraceColors.length]
      const top = new THREE.Mesh(new THREE.PlaneGeometry(x * 2, z * 2), flat(new THREE.Color(color)))
      top.rotation.x = -Math.PI / 2
      top.position.set(platform.center.x, platform.center.y + y / 2 + .02, platform.center.z)
      top.castShadow = true; top.receiveShadow = true; this.scene.add(top)
      // Only the broad, flat base is physical. The colored upper terraces are visual
      // jump markers; solid overlapping boxes were able to trap the player capsule.
      if (index === 0) this.physics.addStaticBox(platform.center, new THREE.Vector3(x, y / 2, z))
    }
    this.addPillars()
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

  private addPillars(): void {
    const random = rng(this.layout.seed)
    for (let i = 0; i < 22; i++) {
      const a = random() * Math.PI * 2; const d = 20 + random() * 25; const h = 4 + random() * 14
      const rock = new THREE.Mesh(new THREE.ConeGeometry(1.8 + random() * 2.5, h, 6), flat(new THREE.Color(i % 2 ? '#30265f' : '#5b3f82')))
      rock.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); rock.rotation.y = random() * 4; this.scene.add(rock)
    }
  }
  private addSkyRibbons(): void {
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(25 + i * 4, .12, 6, 80), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff82c8' : '#72e8ff', transparent: true, opacity: .32 }))
      ring.rotation.x = Math.PI / 2 + i * .08; ring.position.y = 8 + i * 4; this.scene.add(ring)
    }
  }
  private addCrystals(): void {
    const summit = this.layout.summit!
    for (const [i, p] of summit.platforms.entries()) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.35 + i * .03), new THREE.MeshStandardMaterial({ color: '#7ce9e1', emissive: '#46dbe1', emissiveIntensity: 1.2, transparent: true, opacity: .84 }))
      crystal.position.set(p.center.x + p.size.x * .65, p.center.y + p.size.y + .6, p.center.z - p.size.z * .55); this.scene.add(crystal); this.crystals.push(crystal)
    }
  }
}
