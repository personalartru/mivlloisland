import * as THREE from 'three'
import type { Physics } from '../../engine/physics'
import type { LevelLayout } from '../layout'
import { flat, glowSprite, gradientSky, groundTexture, jitter, rng, starField } from './shared'

type Mote = { sprite: THREE.Sprite; home: THREE.Vector3; phase: number; speed: number }
type Moth = { root: THREE.Group; wings: THREE.Mesh[]; center: THREE.Vector3; phase: number; radius: number; height: number }
type Shooter = { mesh: THREE.Line; delay: number; life: number; from: THREE.Vector3; to: THREE.Vector3; speed: number }
type Asteroid = { mesh: THREE.Mesh; baseY: number; phase: number; spin: number }
type BeaconNode = { material: THREE.MeshStandardMaterial; glow: THREE.Sprite }

const CRYSTAL = ['#7ef0ff', '#ff9ae6', '#b79cff', '#9af7ff']
const GROUND_BASE = '#443070'
let discTexture: THREE.Texture | null = null
/** Soft white disc used for glowing crater pools (tinted per crater). */
function softDisc(): THREE.Texture {
  if (discTexture) return discTexture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  discTexture = new THREE.CanvasTexture(canvas)
  discTexture.colorSpace = THREE.SRGBColorSpace
  return discTexture
}

/**
 * Планета Звёздная: a crystal planet adrift in a nebula. Flat and safe to walk like the island,
 * but the horizon curves away into space, crystal spires replace trees and a ringed giant hangs
 * overhead. Six beacon crystals light up as the cosmic friends are helped.
 */
export class PlanetWorld {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn: THREE.Vector3
  private readonly nodes: BeaconNode[] = []
  private readonly beam: THREE.Mesh
  private beaconLight!: THREE.PointLight
  private readonly motes: Mote[] = []
  private readonly moths: Moth[] = []
  private readonly shooters: Shooter[] = []
  private readonly asteroids: Asteroid[] = []
  private readonly twinkles: THREE.Points[] = []
  private time = 0

  constructor(private readonly physics: Physics, shadowMapSize: number, private readonly layout: LevelLayout) {
    const random = rng(layout.seed)
    this.spawn = layout.spawn.clone()
    this.scene.background = new THREE.Color('#08030f')
    this.scene.fog = new THREE.Fog('#1b0b3d', 58, 185)

    this.scene.add(this.makeSky(random))

    const hemi = new THREE.HemisphereLight('#9a7bff', '#2e1a52', 1.05)
    this.sun = new THREE.DirectionalLight('#d9e2ff', 2.0)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -48
    cam.right = cam.top = 48
    cam.near = 1
    cam.far = 170
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    const rim = new THREE.DirectionalLight('#ff6ad5', 0.75)
    rim.position.set(-32, 18, -26)
    const fill = new THREE.DirectionalLight('#5fd0ff', 0.35)
    const ambient = new THREE.AmbientLight('#6a58a0', 0.4)
    fill.position.set(24, 10, 30)
    this.scene.add(hemi, ambient, this.sun, this.sun.target, rim, fill)

    this.addGround(random)
    this.addCraters(random)
    this.addCrystalForest(random)
    this.addShards(random)
    this.beam = this.addBeacon()
    this.addDome()
    this.addLandingPad()
    this.addPaths()
    this.addBoundary(random)
    this.addFloatingRocks(random)
    this.addMotes(random)
    this.addMoths(random)
    this.addShootingStars(random)
    this.addSignpost()
    this.addFloatingIslets(random)
  }

  // ─── sky ────────────────────────────────────────────────────────────────

  private makeSky(random: () => number): THREE.Group {
    const sky = new THREE.Group()
    sky.add(gradientSky({
      top: '#05010f', middle: '#1a0a3a', horizon: '#4a1a6b',
      sunDir: new THREE.Vector3(-0.45, 0.42, -0.78), sunColor: '#ffb3f0', sunStrength: 0.9,
    }))

    const stars = starField(1700, 250, 420, 3.4, this.layout.seed + 3)
    this.twinkles.push(stars)
    sky.add(stars)

    // Nebula banks: a few big soft sprites stacked to read as gas clouds, not cotton balls.
    const nebulaColors = ['#7a4bff', '#ff6ad5', '#3fd8ff', '#a06bff']
    for (let i = 0; i < 12; i += 1) {
      const a = random() * Math.PI * 2
      const d = 210 + random() * 80
      const color = nebulaColors[Math.floor(random() * nebulaColors.length)]
      const group = new THREE.Group()
      group.position.set(Math.cos(a) * d, 8 + random() * 70, Math.sin(a) * d)
      for (let p = 0; p < 3; p += 1) {
        const puff = glowSprite(color, 70 + random() * 80, 0.09 + random() * 0.07)
        puff.position.set((random() - 0.5) * 60, (random() - 0.5) * 40, (random() - 0.5) * 60)
        group.add(puff)
      }
      sky.add(group)
    }

    // The ringed giant that dominates the sky.
    const giant = new THREE.Group()
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(26, 48, 32),
      new THREE.MeshStandardMaterial({ map: gasGiantTexture(this.layout.seed + 17), roughness: 0.85, metalness: 0, fog: false, emissive: '#2a0f4a', emissiveIntensity: 0.35 }),
    )
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(33, 55, 96),
      new THREE.MeshBasicMaterial({ color: '#ffc9f2', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    )
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(37, 41, 96),
      new THREE.MeshBasicMaterial({ color: '#9af7ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    )
    ring.rotation.set(Math.PI * 0.34, 0.08, 0.2)
    ring2.rotation.copy(ring.rotation)
    giant.add(planet, ring, ring2)
    giant.position.set(-138, 44, -186)
    giant.scale.setScalar(1.2)
    giant.rotation.z = -0.16
    sky.add(giant)

    const moons = [
      { r: 9, at: new THREE.Vector3(118, 62, -138), color: '#c9d6ff' },
      { r: 5.5, at: new THREE.Vector3(-70, 76, 148), color: '#ffe6c9' },
    ]
    for (const moon of moons) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(moon.r, 28, 20),
        new THREE.MeshStandardMaterial({ color: moon.color, emissive: '#3a2a6a', emissiveIntensity: 0.4, roughness: 0.9, fog: false }),
      )
      mesh.position.copy(moon.at)
      sky.add(mesh)
    }
    return sky
  }

  private addShootingStars(random: () => number): void {
    for (let i = 0; i < 4; i += 1) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)])
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }))
      line.frustumCulled = false
      this.scene.add(line)
      this.shooters.push({
        mesh: line,
        delay: 2 + random() * 14,
        life: 0,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        speed: 90 + random() * 70,
      })
    }
  }

  // ─── ground ─────────────────────────────────────────────────────────────

  private addGround(random: () => number): void {
    const r = this.layout.radius
    const tex = groundTexture(GROUND_BASE, ['#4b3577', '#2c1f4a', '#5a3f8f', '#262046'], ['rgba(200,180,255,.4)', 'rgba(120,240,255,.32)', 'rgba(255,180,240,.26)'], this.layout.seed)
    tex.repeat.set(4, 4)
    const top = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.05 }))
    top.rotation.x = -Math.PI / 2
    top.position.y = 0.02
    top.receiveShadow = true

    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, 9, 72, 1), flat(new THREE.Color('#2a1c4a')))
    body.position.y = -4.5
    body.receiveShadow = true

    // The planet itself, curving away under the playable plateau.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(70, 48, 32),
      new THREE.MeshStandardMaterial({ color: '#5a4090', roughness: 1, metalness: 0, map: tex.clone() }),
    )
    const shellMap = shell.material.map!
    shellMap.repeat.set(10, 10)
    shellMap.needsUpdate = true
    shell.position.y = -70.5
    shell.receiveShadow = true

    const edge = new THREE.Mesh(new THREE.TorusGeometry(r - 0.15, 0.09, 6, 96), new THREE.MeshBasicMaterial({ color: '#9af7ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
    edge.rotation.x = Math.PI / 2
    edge.position.y = 0.06

    this.scene.add(top, body, shell, edge)

    // Glowing veins of energy across the crystal crust.
    const veinMat = new THREE.MeshBasicMaterial({ color: '#7ef0ff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    for (let i = 0; i < 16; i += 1) {
      const a = random() * Math.PI * 2
      const start = 3 + random() * 6
      const end = start + 5 + random() * 9
      const points: THREE.Vector3[] = []
      for (let s = 0; s <= 4; s += 1) {
        const t = s / 4
        const d = start + (end - start) * t
        const wobble = (random() - 0.5) * 0.9
        points.push(new THREE.Vector3(Math.cos(a + wobble * 0.05) * d, 0.045, Math.sin(a + wobble * 0.05) * d))
      }
      const curve = new THREE.CatmullRomCurve3(points)
      const geo = new THREE.TubeGeometry(curve, 24, 0.035 + random() * 0.03, 4, false)
      const vein = new THREE.Mesh(geo, veinMat)
      this.scene.add(vein)
    }
    this.physics.addStaticCylinder(new THREE.Vector3(0, -4.5, 0), r, 9)
  }

  private addCraters(random: () => number): void {
    const craters = [
      { x: -6, z: -7, r: 3.6, color: '#ff6ad5' },
      { x: 7, z: -4, r: 2.7, color: '#7ef0ff' },
      { x: -20, z: 14, r: 4.2, color: '#b79cff' },
      { x: 21, z: 16, r: 3.3, color: '#ff9ae6' },
      { x: -2, z: 6.5, r: 2.2, color: '#7ef0ff' },
    ]
    for (const crater of craters) {
      const basin = new THREE.Mesh(new THREE.CircleGeometry(crater.r, 40), flat(new THREE.Color('#251a45')))
      basin.rotation.x = -Math.PI / 2
      basin.position.set(crater.x, 0.035, crater.z)
      basin.receiveShadow = true
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(crater.r * 1.9, crater.r * 1.9),
        new THREE.MeshBasicMaterial({ map: softDisc(), color: crater.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      pool.rotation.x = -Math.PI / 2
      pool.position.set(crater.x, 0.05, crater.z)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(crater.r, 0.3, 6, 40), flat(new THREE.Color('#3a2a63')))
      rim.rotation.x = Math.PI / 2
      rim.scale.y = 0.45
      rim.position.set(crater.x, 0.12, crater.z)
      rim.castShadow = true
      this.scene.add(basin, pool, rim)
      for (let i = 0; i < 5; i += 1) {
        const a = random() * Math.PI * 2
        const d = crater.r + 0.5 + random() * 0.8
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + random() * 0.3, 0), flat(new THREE.Color('#4a3670')))
        rock.position.set(crater.x + Math.cos(a) * d, 0.16, crater.z + Math.sin(a) * d)
        rock.rotation.set(random(), random() * 3, random())
        rock.castShadow = true
        this.scene.add(rock)
      }
    }
  }

  // ─── crystal landscape ──────────────────────────────────────────────────

  private addCrystalForest(random: () => number): void {
    const clusters: Array<[number, number]> = [
      [-19, -14], [-9, -17], [20, -18], [13, 17], [-24, 0], [23, 6], [6, 12.5], [-22, 20],
    ]
    for (const [cx, cz] of clusters) {
      const group = new THREE.Group()
      group.position.set(cx, 0, cz)
      const spires = 4 + Math.floor(random() * 4)
      let tallest = 0
      for (let i = 0; i < spires; i += 1) {
        const height = 1.4 + random() * 4.2
        tallest = Math.max(tallest, height)
        const color = CRYSTAL[Math.floor(random() * CRYSTAL.length)]
        const mat = new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.32, roughness: 0.14, metalness: 0.18,
          flatShading: true, transparent: true, opacity: 0.92,
        })
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.26 + random() * 0.26, height, 5), mat)
        const a = random() * Math.PI * 2
        const d = random() * 1.7
        spire.position.set(Math.cos(a) * d, height / 2, Math.sin(a) * d)
        spire.rotation.z = (random() - 0.5) * 0.28
        spire.rotation.y = random() * Math.PI
        spire.castShadow = true
        spire.receiveShadow = true
        group.add(spire)
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }))
        tip.position.set(spire.position.x, height + 0.02, spire.position.z)
        group.add(tip)
      }
      this.scene.add(group)
      this.physics.addStaticCylinder(new THREE.Vector3(cx, tallest * 0.4, cz), 1.05, tallest * 0.8)
    }
  }

  private addShards(random: () => number): void {
    const shardMat = new THREE.MeshStandardMaterial({
      color: '#9af7ff', emissive: '#3fa9ff', emissiveIntensity: 0.5, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9,
    })
    for (let i = 0; i < 34; i += 1) {
      const a = random() * Math.PI * 2
      const d = 4 + random() * 24
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (this.nearSpot(x, z, 1.4)) continue
      const h = 0.3 + random() * 0.8
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.1 + random() * 0.12, h, 4), shardMat)
      shard.position.set(x, h / 2, z)
      shard.rotation.set((random() - 0.5) * 0.4, random() * Math.PI, (random() - 0.5) * 0.4)
      shard.castShadow = true
      this.scene.add(shard)
    }
  }

  // ─── landmarks ──────────────────────────────────────────────────────────

  /** The cosmic beacon: one crystal per completed task, plus a beam of light. */
  private addBeacon(): THREE.Mesh {
    const at = this.layout.landmark
    const group = new THREE.Group()
    group.position.copy(at)

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.1, 0.34, 6), flat(new THREE.Color('#2d2152')))
    platform.position.y = 0.17
    platform.receiveShadow = true
    platform.castShadow = true
    const trim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: '#9af7ff', transparent: true, opacity: 0.7 }))
    trim.rotation.x = Math.PI / 2
    trim.position.y = 0.36
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 7.2, 6), new THREE.MeshStandardMaterial({
      color: '#6a58a0', emissive: '#3a2a7a', emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.2, flatShading: true,
    }))
    column.position.y = 3.9
    column.castShadow = true
    group.add(column)
    const bandMat = new THREE.MeshBasicMaterial({ color: '#9af7ff', transparent: true, opacity: 0.85 })
    for (let i = 0; i < 5; i += 1) {
      const y = 1.2 + i * 1.35
      const radius = 0.78 - (i / 5) * 0.36
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.028, 5, 18), bandMat)
      band.rotation.x = Math.PI / 2
      band.position.y = y
      group.add(band)
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), new THREE.MeshStandardMaterial({
      color: '#ffe9a8', emissive: '#ffc94a', emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.2, flatShading: true,
    }))
    crystal.position.y = 8.1
    crystal.scale.set(1, 1.35, 1)
    crystal.castShadow = true
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: '#ffd6f6', transparent: true, opacity: 0.8 }))
    ring.position.y = 8.1
    ring.rotation.x = Math.PI / 2.6

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 18, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    )
    beam.position.y = 8.4 + 9
    const light = new THREE.PointLight('#ffe9a8', 0.8, 22, 1.6)
    light.position.y = 8.1

    group.add(platform, trim, column, crystal, ring, beam, light)
    this.beaconLight = light

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2
      const material = new THREE.MeshStandardMaterial({ color: '#6a5a92', emissive: '#ffc94a', emissiveIntensity: 0.1, roughness: 0.25, flatShading: true })
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), material)
      node.position.set(Math.cos(a) * 2.1, 0.95, Math.sin(a) * 2.1)
      const glow = glowSprite('#ffe9a8', 0.9, 0)
      glow.position.copy(node.position)
      group.add(node, glow)
      this.nodes.push({ material, glow })
    }

    this.scene.add(group)
    this.physics.addStaticCylinder(new THREE.Vector3(at.x, 4, at.z), 1.0, 7.5)

    // A ring of small crystals around the beacon plaza.
    const plazaMat = new THREE.MeshStandardMaterial({ color: '#8f7ad6', emissive: '#5a3f9e', emissiveIntensity: 0.4, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9 })
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + 0.26
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 4), plazaMat)
      shard.position.set(at.x + Math.cos(a) * 3.6, 0.27, at.z + Math.sin(a) * 3.6)
      this.scene.add(shard)
    }
    return beam
  }

  private addDome(): void {
    const at = this.layout.building
    const group = new THREE.Group()
    group.position.copy(at)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.6, 18), flat(new THREE.Color('#2f2456')))
    base.position.y = 0.3
    base.receiveShadow = true
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#8ff0ff', emissive: '#3fb8d8', emissiveIntensity: 0.35, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide,
    })
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), glassMat)
    dome.position.y = 0.6
    const ribs = new THREE.MeshBasicMaterial({ color: '#c9f7ff', transparent: true, opacity: 0.55 })
    for (let i = 0; i < 3; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.035, 5, 32, Math.PI), ribs)
      rib.rotation.y = (i / 3) * Math.PI
      rib.position.y = 0.6
      group.add(rib)
    }
    const telescope = new THREE.Group()
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 10), flat(new THREE.Color('#d9d6ff')))
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: '#9af7ff', emissive: '#3fd8ff', emissiveIntensity: 1.4, roughness: 0.2 }))
    lens.position.y = 1.35
    telescope.add(tube, lens)
    telescope.position.set(0.4, 2.6, 0)
    telescope.rotation.z = -0.6
    telescope.rotation.x = 0.3
    group.add(base, dome, telescope)

    // A tiny landing light strip so the dome reads as a place someone lives.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const light = glowSprite('#7ef0ff', 0.5, 0.8)
      light.position.set(Math.cos(a) * 3.4, 0.3, Math.sin(a) * 3.4)
      group.add(light)
    }
    this.scene.add(group)
    this.physics.addStaticCylinder(new THREE.Vector3(at.x, 1.6, at.z), 3.3, 3.2)
  }

  private addLandingPad(): void {
    const at = new THREE.Vector3(17, 0, 4)
    const group = new THREE.Group()
    group.position.copy(at)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.22, 28), flat(new THREE.Color('#2b2050')))
    pad.position.y = 0.11
    pad.receiveShadow = true
    for (const [radius, opacity] of [[2.5, 0.7], [1.6, 0.45], [0.9, 0.3]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 5, 48), new THREE.MeshBasicMaterial({ color: '#ff9ae6', transparent: true, opacity, blending: THREE.AdditiveBlending }))
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.24
      group.add(ring)
    }
    const saucer = new THREE.Group()
    saucer.position.y = 1.05
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 14), new THREE.MeshStandardMaterial({ color: '#d9d6ff', roughness: 0.35, metalness: 0.25, flatShading: true }))
    hull.scale.set(1, 0.34, 1)
    const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9af7ff', emissive: '#3fd8ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.1 }))
    cabin.position.y = 0.2
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 28), flat(new THREE.Color('#8f7ad6')))
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.16
    saucer.add(hull, cabin, collar)
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      const lamp = glowSprite(i % 2 ? '#ffe07a' : '#ff9ae6', 0.55, 0.9)
      lamp.position.set(Math.cos(a) * 1.25, 0.02, Math.sin(a) * 1.25)
      saucer.add(lamp)
    }
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), flat(new THREE.Color('#8f7ad6')))
      leg.position.set(Math.cos(a) * 0.9, -0.55, Math.sin(a) * 0.9)
      leg.rotation.z = Math.cos(a) * 0.25
      leg.rotation.x = -Math.sin(a) * 0.25
      saucer.add(leg)
    }
    group.add(pad, saucer)
    this.scene.add(group)
    this.physics.addStaticCylinder(new THREE.Vector3(at.x, 1.1, at.z), 1.5, 1.6)
  }

  private addPaths(): void {
    const routes: THREE.Vector3[][] = [
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 0, 3), new THREE.Vector3(8, 0, 6), new THREE.Vector3(12.5, 0, 8.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-4, 0, 4), new THREE.Vector3(-8, 0, 8), new THREE.Vector3(-11.5, 0, 10.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, -5), new THREE.Vector3(0.5, 0, -9), new THREE.Vector3(0, 0, -12.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-5, 0, -3), new THREE.Vector3(-10, 0, -5), new THREE.Vector3(-14.5, 0, -6.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, -3), new THREE.Vector3(11, 0, -5), new THREE.Vector3(15.5, 0, -7.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2, 0, 6), new THREE.Vector3(-3, 0, 12), new THREE.Vector3(-3.5, 0, 17.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0, 8), new THREE.Vector3(0.2, 0, 16), new THREE.Vector3(0, 0, 22.6)],
    ]
    const wide = new THREE.MeshBasicMaterial({ color: '#7ef0ff', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false })
    const core = new THREE.MeshBasicMaterial({ color: '#c9f7ff', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const route of routes) {
      const curve = new THREE.CatmullRomCurve3(route, false, 'catmullrom', 0.2)
      for (const [half, mat, y] of [[1.1, wide, 0.03], [0.26, core, 0.035]] as const) {
        const segments = 48
        const positions: number[] = []
        const indices: number[] = []
        for (let i = 0; i <= segments; i += 1) {
          const t = i / segments
          const p = curve.getPoint(t)
          const tangent = curve.getTangent(t).setY(0).normalize()
          const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
          positions.push(p.x + normal.x * half, y, p.z + normal.z * half)
          positions.push(p.x - normal.x * half, y, p.z - normal.z * half)
          if (i < segments) {
            const a = i * 2
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
          }
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geo.setIndex(indices)
        geo.computeVertexNormals()
        this.scene.add(new THREE.Mesh(geo, mat))
      }
    }
  }

  private addBoundary(random: () => number): void {
    const count = 64
    const radius = this.layout.playableRadius + 0.9
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2
      const x = Math.cos(a) * radius
      const z = Math.sin(a) * radius
      this.physics.addStaticBox(
        new THREE.Vector3(x, 2.5, z),
        new THREE.Vector3(0.6, 5, 3.5),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a),
      )
      if (i % 2 === 0) {
        const h = 1.4 + random() * 2.6
        const color = CRYSTAL[i % CRYSTAL.length]
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.3 + random() * 0.2, h, 5), new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.25, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9,
        }))
        spire.position.set(Math.cos(a) * (radius - 0.4), h / 2, Math.sin(a) * (radius - 0.4))
        spire.rotation.z = (random() - 0.5) * 0.2
        spire.castShadow = true
        this.scene.add(spire)
      }
    }
  }

  private addFloatingRocks(random: () => number): void {
    for (let i = 0; i < 7; i += 1) {
      const a = random() * Math.PI * 2
      const d = 13 + random() * 13
      const size = 0.4 + random() * 0.6
      const geo = new THREE.IcosahedronGeometry(size, 0)
      jitter(geo, random, size * 0.4)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: i % 2 ? '#6a58a0' : '#5a4890', emissive: '#3a2a6e', emissiveIntensity: 0.45, roughness: 0.9, flatShading: true }))
      const y = 6.5 + random() * 4.5
      mesh.position.set(Math.cos(a) * d, y, Math.sin(a) * d)
      mesh.rotation.set(random() * 3, random() * 3, random() * 3)
      mesh.castShadow = true
      this.scene.add(mesh)
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(size * 0.18, size * 0.8, 4), new THREE.MeshStandardMaterial({
        color: '#9af7ff', emissive: '#3fd8ff', emissiveIntensity: 0.8, roughness: 0.2, flatShading: true,
      }))
      crystal.position.set(mesh.position.x, y + size * 0.8, mesh.position.z)
      this.scene.add(crystal)
      this.asteroids.push({ mesh, baseY: y, phase: random() * Math.PI * 2, spin: 0.05 + random() * 0.12 })
    }
  }

  /** Broken shards of the planet drifting just beyond the rim. */
  private addFloatingIslets(random: () => number): void {
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + random() * 0.6
      const d = 34 + random() * 9
      const r = 1.5 + random() * 1.3
      const group = new THREE.Group()
      const geo = new THREE.IcosahedronGeometry(r, 0)
      jitter(geo, random, r * 0.35)
      const rock = new THREE.Mesh(geo, flat(new THREE.Color(i % 2 ? '#4a3670' : '#3a2a5e')))
      rock.scale.y = 0.55
      rock.castShadow = true
      group.add(rock)
      const shards = 2 + Math.floor(random() * 2)
      for (let s = 0; s < shards; s += 1) {
        const h = 0.6 + random() * 1.4
        const color = CRYSTAL[Math.floor(random() * CRYSTAL.length)]
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16 + random() * 0.12, h, 4), new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.5, roughness: 0.2, flatShading: true,
        }))
        shard.position.set((random() - 0.5) * r, r * 0.35 + h / 2, (random() - 0.5) * r)
        group.add(shard)
      }
      group.position.set(Math.cos(a) * d, -2 - random() * 5, Math.sin(a) * d)
      group.rotation.y = random() * Math.PI
      this.scene.add(group)
    }
  }

  // ─── ambience ───────────────────────────────────────────────────────────

  private addMotes(random: () => number): void {
    const colors = ['#9af7ff', '#ffd6f6', '#ffe07a', '#c9b6ff']
    for (let i = 0; i < 54; i += 1) {
      const a = random() * Math.PI * 2
      const d = 7 + random() * 18
      const sprite = glowSprite(colors[Math.floor(random() * colors.length)], 0.16 + random() * 0.2, 0.22 + random() * 0.24)
      const home = new THREE.Vector3(Math.cos(a) * d, 0.5 + random() * 3, Math.sin(a) * d)
      sprite.position.copy(home)
      this.scene.add(sprite)
      this.motes.push({ sprite, home, phase: random() * Math.PI * 2, speed: 0.3 + random() * 0.5 })
    }
  }

  private addMoths(random: () => number): void {
    const colors = ['#9af7ff', '#ffd6f6', '#ffe07a']
    for (let i = 0; i < 8; i += 1) {
      const root = new THREE.Group()
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat)
      const wings = [
        new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), mat),
        new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), mat),
      ]
      wings[0].position.x = -0.18
      wings[1].position.x = 0.18
      wings[0].rotation.y = Math.PI / 2
      wings[1].rotation.y = -Math.PI / 2
      root.add(body, ...wings)
      const center = new THREE.Vector3(-10 + random() * 20, 0, -10 + random() * 20)
      root.position.set(center.x, 1.8, center.z)
      this.scene.add(root)
      this.moths.push({ root, wings, center, phase: random() * Math.PI * 2, radius: 1.6 + random() * 2.6, height: 1.4 + random() * 1.8 })
    }
  }

  private addSignpost(): void {
    const x = 6.2
    const z = -6.2
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.4, 6), flat(new THREE.Color('#4a3670')))
    post.position.set(x, 1.2, z)
    post.castShadow = true
    const glow = glowSprite('#9af7ff', 0.6, 0.7)
    glow.position.set(x, 2.55, z)
    this.scene.add(post, glow)
    const signs: Array<[string, string]> = [
      ['Маяк', '#ffd6f6'],
      ['Кристаллы', '#9af7ff'],
      ['Купол', '#b79cff'],
      ['Озеро', '#ff9ae6'],
    ]
    signs.forEach(([label, color], i) => {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'rgba(10,4,24,0.5)'
      ctx.beginPath()
      ctx.roundRect(8, 8, 496, 112, 34)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 8
      ctx.stroke()
      ctx.fillStyle = color
      ctx.font = '800 54px Nunito, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 256, 64)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.85, 0.46),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      )
      const facing = Math.atan2(this.spawn.x - x, this.spawn.z - z)
      board.position.set(x + Math.sin(facing) * 0.22, 2.2 - i * 0.5, z + Math.cos(facing) * 0.22)
      board.rotation.y = facing
      this.scene.add(board)
    })
  }

  // ─── runtime ────────────────────────────────────────────────────────────

  /** Light one beacon crystal per completed task. */
  setLanterns(done: number): void {
    for (const [i, node] of this.nodes.entries()) {
      const on = i < done
      node.material.emissiveIntensity = on ? 2.4 : 0.1
      node.material.color.set(on ? '#ffe9a8' : '#6a5a92')
      ;(node.glow.material as THREE.SpriteMaterial).opacity = on ? 0.9 : 0
    }
    this.beaconLight.intensity = 0.6 + done * 0.22
    ;(this.beam.material as THREE.MeshBasicMaterial).opacity = 0.02 + done * 0.012
  }

  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt
    const t = this.time
    this.sun.position.set(focus.x + 26, focus.y + 46, focus.z + 18)
    this.sun.target.position.copy(focus)

    for (const stars of this.twinkles) (stars.userData.timeUniform as THREE.IUniform<number>).value = t

    for (const mote of this.motes) {
      const a = t * mote.speed * 0.3 + mote.phase
      mote.sprite.position.set(
        mote.home.x + Math.cos(a) * 1.1,
        mote.home.y + Math.sin(t * 0.9 + mote.phase) * 0.35,
        mote.home.z + Math.sin(a) * 1.1,
      )
      const near = mote.sprite.position.distanceTo(focus)
      const fade = THREE.MathUtils.clamp((near - 3.5) / 4, 0, 1)
      ;(mote.sprite.material as THREE.SpriteMaterial).opacity = (0.16 + (Math.sin(t * 1.7 + mote.phase) + 1) * 0.12) * fade
    }

    for (const moth of this.moths) {
      const a = t * 0.55 + moth.phase
      moth.root.position.set(
        moth.center.x + Math.cos(a) * moth.radius,
        moth.height + Math.sin(t * 1.8 + moth.phase) * 0.24,
        moth.center.z + Math.sin(a) * moth.radius,
      )
      moth.root.rotation.y = -a
      for (const [i, wing] of moth.wings.entries()) wing.rotation.z = (i === 0 ? 1 : -1) * (0.3 + Math.sin(t * 14 + moth.phase) * 0.6)
    }

    for (const rock of this.asteroids) {
      rock.mesh.position.y = rock.baseY + Math.sin(t * 0.5 + rock.phase) * 0.35
      rock.mesh.rotation.y += dt * rock.spin
      rock.mesh.rotation.x += dt * rock.spin * 0.4
    }

    for (const shooter of this.shooters) {
      shooter.life += dt
      const cycle = shooter.delay + 3.2
      if (shooter.life > cycle) {
        shooter.life = 0
        const a = Math.random() * Math.PI * 2
        const d = 260
        shooter.from.set(Math.cos(a) * d, 90 + Math.random() * 80, Math.sin(a) * d)
        shooter.to.set(shooter.from.x - 90 - Math.random() * 60, shooter.from.y - 45, shooter.from.z + 40 + Math.random() * 50)
      }
      const k = THREE.MathUtils.clamp((shooter.life - shooter.delay) / 0.9, 0, 1)
      const visible = shooter.life > shooter.delay && k < 1
      const material = shooter.mesh.material as THREE.LineBasicMaterial
      material.opacity = visible ? Math.sin(k * Math.PI) * 0.9 : 0
      if (visible) {
        const pos = new THREE.Vector3().lerpVectors(shooter.from, shooter.to, k)
        const tail = new THREE.Vector3().lerpVectors(shooter.from, shooter.to, Math.max(0, k - 0.12))
        shooter.mesh.geometry.setFromPoints([pos, tail])
      }
    }

    // The beacon turns slowly so its beam sweeps the plaza.
    this.beam.rotation.y = t * 0.15
  }

  private nearSpot(x: number, z: number, pad: number): boolean {
    for (const spot of Object.values(this.layout.npcSpots)) {
      if (spot && Math.hypot(spot.x - x, spot.z - z) < 2 + pad) return true
    }
    for (const spots of Object.values(this.layout.itemSpots)) {
      for (const spot of spots ?? []) if (Math.hypot(spot.x - x, spot.z - z) < 1.2 + pad) return true
    }
    if (Math.hypot(this.layout.landmark.x - x, this.layout.landmark.z - z) < 4 + pad) return true
    if (Math.hypot(this.layout.building.x - x, this.layout.building.z - z) < 4 + pad) return true
    return false
  }
}

/** Banded gas giant texture, repeatable for the same level seed. */
function gasGiantTexture(seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const random = rng(seed)
  const bands = ['#7a5cc9', '#a97ee0', '#6a4bb0', '#d9a6f0', '#8f6bd6', '#b98be8', '#5a3f9e']
  let y = 0
  while (y < canvas.height) {
    const h = 8 + random() * 26
    ctx.fillStyle = bands[Math.floor(random() * bands.length)]
    ctx.fillRect(0, y, canvas.width, h)
    y += h
  }
  // Soft swirls break the straight bands.
  for (let i = 0; i < 26; i += 1) {
    const cx = random() * canvas.width
    const cy = random() * canvas.height
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + random() * 50)
    g.addColorStop(0, 'rgba(255,220,255,0.35)')
    g.addColorStop(1, 'rgba(255,220,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - 80, cy - 40, 160, 80)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  return tex
}
