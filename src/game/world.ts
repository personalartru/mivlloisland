import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Physics } from '../engine/physics'
import { instantiate, type PropKey } from './models'
import { haloTexture } from './textures'
import { ISLAND_LAYOUT, PLANET_LAYOUT, type LevelLayout } from './layout'
import type { LevelId } from './levels'
import { flat, jitter, rng, signTexture } from './world/shared'
import { PlanetWorld } from './world/planet'

/**
 * The single cozy island of Чудо-остров. The ground is flat so very young players can never get
 * stuck on a slope; variety comes from paths, zones, props, water, flowers and friendly details.
 */
export const WORLD = ISLAND_LAYOUT

export const PALETTE = {
  skyTop: new THREE.Color('#7cc6ff'),
  horizon: new THREE.Color('#d9efff'),
  grass: new THREE.Color('#8ed66c'),
  grassDark: new THREE.Color('#6abf58'),
  sand: new THREE.Color('#f1d8a2'),
  sandDark: new THREE.Color('#e0c48c'),
  rock: new THREE.Color('#b08a6a'),
  rockDark: new THREE.Color('#7c5f4b'),
  trunk: new THREE.Color('#8a5a3c'),
  leaf: [new THREE.Color('#5cbf5c'), new THREE.Color('#79d06a'), new THREE.Color('#4fae5a'), new THREE.Color('#a6d96b')],
  water: new THREE.Color('#67cdf0'),
  stone: new THREE.Color('#d9c9a8'),
  flower: ['#ff8a9c', '#ffd35c', '#ffffff', '#b79cff', '#ff9a5c', '#8ed6ff'],
}

type Lantern = { glow: THREE.MeshStandardMaterial; light: THREE.PointLight; phase: number }
type Butterfly = { root: THREE.Group; wings: THREE.Mesh[]; center: THREE.Vector3; phase: number; radius: number; height: number }
type Firefly = { sprite: THREE.Sprite; home: THREE.Vector3; phase: number }

export type WorldView = {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  spawn: THREE.Vector3
  update(dt: number, focus: THREE.Vector3): void
  setLanterns(done: number): void
}

export class IslandWorld implements WorldView {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn: THREE.Vector3
  private readonly clouds: THREE.Object3D[] = []
  private readonly ripples: THREE.Mesh[] = []
  private readonly lanterns: Lantern[] = []
  private readonly butterflies: Butterfly[] = []
  private readonly fireflies: Firefly[] = []
  private readonly water: THREE.Mesh
  private time = 0

  constructor(
    private readonly physics: Physics,
    shadowMapSize: number,
    props: Record<PropKey, GLTF>,
    private readonly layout: LevelLayout = ISLAND_LAYOUT,
  ) {
    const random = rng(layout.seed)
    this.spawn = layout.spawn.clone()
    this.scene.background = new THREE.Color(PALETTE.horizon)
    this.scene.fog = new THREE.Fog(PALETTE.horizon, 65, 190)

    this.scene.add(this.makeSky())
    this.scene.add(new THREE.HemisphereLight('#d8f1ff', '#7fae63', 1.15))
    this.sun = new THREE.DirectionalLight('#fff2d6', 2.1)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -38
    cam.right = cam.top = 38
    cam.near = 1
    cam.far = 120
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target)

    this.addIsland()
    this.addPaths()
    this.water = this.addPond(random)
    this.addTree(props.tree, random)
    this.addCottage(props.cottage, random)
    this.addSignpost()
    this.addDecor(random)
    this.addBoundary(random)
    this.addClouds(random)
    this.addDistantIslands(random)
    this.addButterflies(random)
    this.addFireflies(random)
  }

  /** Per-frame ambience: drifting clouds, water shimmer, butterflies and the sun following the player. */
  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt
    for (const c of this.clouds) {
      c.position.x += dt * (c.userData.speed as number)
      if (c.position.x > 140) c.position.x = -140
    }
    this.sun.position.set(focus.x + 22, focus.y + 40, focus.z + 16)
    this.sun.target.position.copy(focus)

    this.water.position.y = 0.035 + Math.sin(this.time * 1.1) * 0.008
    for (const [i, ring] of this.ripples.entries()) {
      const k = (this.time * 0.22 + i * 0.33) % 1
      ring.scale.setScalar(0.35 + k * 2.2)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.28
    }
    for (const l of this.lanterns) {
      const pulse = 0.85 + Math.sin(this.time * 2 + l.phase) * 0.15
      l.light.intensity = l.light.intensity > 0.01 ? 0.75 * pulse : 0
      l.glow.emissiveIntensity = l.glow.emissiveIntensity > 0.2 ? 2.4 * pulse : 0.15
    }
    for (const b of this.butterflies) {
      const a = this.time * 0.7 + b.phase
      b.root.position.set(b.center.x + Math.cos(a) * b.radius, b.height + Math.sin(this.time * 2.4 + b.phase) * 0.18, b.center.z + Math.sin(a) * b.radius)
      b.root.rotation.y = -a
      for (const [i, wing] of b.wings.entries()) wing.rotation.z = (i === 0 ? 1 : -1) * (0.35 + Math.sin(this.time * 16 + b.phase) * 0.55)
    }
    for (const f of this.fireflies) {
      f.sprite.position.set(
        f.home.x + Math.sin(this.time * 0.6 + f.phase) * 1.4,
        f.home.y + Math.sin(this.time * 1.7 + f.phase * 2) * 0.35,
        f.home.z + Math.cos(this.time * 0.5 + f.phase) * 1.4,
      )
      ;(f.sprite.material as THREE.SpriteMaterial).opacity = 0.35 + (Math.sin(this.time * 3 + f.phase) + 1) * 0.3
    }
  }

  /** Light one lantern around the Friendship Tree per completed task. */
  setLanterns(done: number): void {
    for (const [i, l] of this.lanterns.entries()) {
      const on = i < done
      l.glow.emissiveIntensity = on ? 2.4 : 0.15
      l.light.intensity = on ? 0.75 : 0
    }
  }

  private makeSky(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: PALETTE.skyTop },
        horizon: { value: PALETTE.horizon },
        sunDir: { value: new THREE.Vector3(22, 40, 16).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.6));
          col = mix(col, horizon * 0.95, smoothstep(0.0, -0.4, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 2.5 + pow(s, 10.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat)
    sky.renderOrder = -1
    return sky
  }

  private addIsland(): void {
    const r = this.layout.radius
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.985, 1.2, 72, 1), flat(PALETTE.grass))
    top.position.y = -0.6
    top.receiveShadow = true
    top.castShadow = true
    this.scene.add(top)

    const beach = new THREE.Mesh(new THREE.RingGeometry(r - 3.1, r, 72, 1), flat(PALETTE.sand))
    beach.rotation.x = -Math.PI / 2
    beach.position.y = 0.012
    beach.receiveShadow = true
    this.scene.add(beach)

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.93, 0.9, 72, 1), flat(PALETTE.grassDark))
    rim.position.y = -1.55
    this.scene.add(rim)

    const under = new THREE.ConeGeometry(r * 0.92, r * 1.45 + 4, 24, 4)
    jitter(under, rng(7), 0.35)
    const rock = new THREE.Mesh(under, flat(PALETTE.rock))
    rock.rotation.x = Math.PI
    rock.position.y = -1.95 - (r * 1.45 + 4) / 2
    rock.castShadow = true
    this.scene.add(rock)

    this.physics.addStaticCylinder(new THREE.Vector3(0, -0.6, 0), r, 1.2)
  }

  private addPaths(): void {
    const spots = this.layout.npcSpots
    const routes: THREE.Vector3[][] = [
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 0, 2), new THREE.Vector3(9, 0, 5), spots.grandma!.clone()],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0, -5), new THREE.Vector3(1.5, 0, -9), spots.fairy!.clone().setZ(-11.5)],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-5, 0, 2), new THREE.Vector3(-10, 0, 3), spots.mushroom!.clone()],
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2, 0, 6), new THREE.Vector3(-3, 0, 11), spots.cat!.clone().setZ(15.5)],
    ]
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 })
    for (const route of routes) {
      const curve = new THREE.CatmullRomCurve3(route, false, 'catmullrom', 0.2)
      const segments = 48
      const half = 0.95
      const positions: number[] = []
      const indices: number[] = []
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments
        const p = curve.getPoint(t)
        const tangent = curve.getTangent(t).setY(0).normalize()
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
        positions.push(p.x + normal.x * half, 0.022, p.z + normal.z * half)
        positions.push(p.x - normal.x * half, 0.022, p.z - normal.z * half)
        if (i < segments) {
          const a = i * 2
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, mat)
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  private addPond(random: () => number): THREE.Mesh {
    const { center, radius } = this.layout.water
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshStandardMaterial({ color: PALETTE.water, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0 }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.set(center.x, 0.035, center.z)
    this.scene.add(water)

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.05, 40),
        new THREE.MeshBasicMaterial({ color: '#d8f8ff', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(center.x, 0.055, center.z)
      this.scene.add(ring)
      this.ripples.push(ring)
    }

    // Stones around the shore.
    for (let i = 0; i < 22; i += 1) {
      const a = (i / 22) * Math.PI * 2 + random() * 0.12
      const d = radius + 0.25 + random() * 0.5
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + random() * 0.3, 0), flat(random() > 0.5 ? PALETTE.stone : PALETTE.rock))
      stone.position.set(center.x + Math.cos(a) * d, 0.16, center.z + Math.sin(a) * d)
      stone.rotation.set(random(), random() * 3, random())
      stone.castShadow = true
      this.scene.add(stone)
    }
    // Lily pads and reeds.
    for (let i = 0; i < 7; i += 1) {
      const a = random() * Math.PI * 2
      const d = 1.2 + random() * (radius - 2)
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.32 + random() * 0.22, 0.32 + random() * 0.22, 0.03, 12), flat(new THREE.Color('#63b95c')))
      pad.position.set(center.x + Math.cos(a) * d, 0.07, center.z + Math.sin(a) * d)
      this.scene.add(pad)
    }
    for (let i = 0; i < 12; i += 1) {
      const a = random() * Math.PI * 2
      const d = radius + 0.4 + random() * 0.9
      const reed = new THREE.Group()
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2 + random() * 0.5, 5), flat(new THREE.Color('#6fae5a')))
      stem.position.y = 0.7
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), flat(new THREE.Color('#9a6b45')))
      tip.position.y = 1.35
      reed.add(stem, tip)
      reed.position.set(center.x + Math.cos(a) * d, 0, center.z + Math.sin(a) * d)
      this.scene.add(reed)
    }
    return water
  }

  private addTree(gltf: GLTF, random: () => number): void {
    const at = this.layout.landmark
    const tree = instantiate(gltf, { height: 11 })
    tree.position.copy(at)
    tree.rotation.y = -0.4
    this.scene.add(tree)
    this.physics.addStaticCylinder(new THREE.Vector3(at.x, 2.2, at.z), 1.35, 4.4)

    // A flower ring around the landmark.
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2
      const d = 4.4 + random() * 0.6
      const flower = this.makeFlower(random)
      flower.position.set(at.x + Math.cos(a) * d, 0, at.z + Math.sin(a) * d)
      this.scene.add(flower)
    }

    // Four lantern posts that light up as tasks are completed.
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const d = 5.2
      const x = at.x + Math.cos(a) * d
      const z = at.z + Math.sin(a) * d
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.4, 7), flat(PALETTE.trunk))
      post.position.set(x, 1.2, z)
      post.castShadow = true
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 8), flat(PALETTE.rockDark))
      cap.position.set(x, 2.55, z)
      const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe28a', emissive: '#ffc94a', emissiveIntensity: 0.15, roughness: 0.3 })
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), glowMat)
      glow.position.set(x, 2.2, z)
      const light = new THREE.PointLight('#ffd27a', 0, 7, 1.6)
      light.position.set(x, 2.3, z)
      this.scene.add(post, cap, glow, light)
      this.lanterns.push({ glow: glowMat, light, phase: i * 1.7 })
    }
  }

  private addCottage(gltf: GLTF, random: () => number): void {
    const at = this.layout.building
    const cottage = instantiate(gltf, { height: 3.6 })
    cottage.position.copy(at)
    cottage.rotation.y = Math.atan2(this.spawn.x - at.x, this.spawn.z - at.z)
    this.scene.add(cottage)
    this.physics.addStaticBox(new THREE.Vector3(at.x, 1.8, at.z), new THREE.Vector3(4.2, 3.6, 4.2))

    // A little garden fence on the meadow side.
    const fenceMat = flat(new THREE.Color('#d9b27c'))
    for (let i = 0; i < 7; i += 1) {
      const x = at.x - 3.8 + i * 1.25
      const z = at.z - 3.4
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), fenceMat)
      post.position.set(x, 0.42, z)
      post.castShadow = true
      this.scene.add(post)
      if (i < 6) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 0.08), fenceMat)
        rail.position.set(x + 0.62, 0.55, z)
        this.scene.add(rail)
      }
    }
    for (let i = 0; i < 8; i += 1) {
      const flower = this.makeFlower(random)
      flower.position.set(at.x - 3.4 + random() * 6, 0, at.z - 3 + random() * 1.4)
      this.scene.add(flower)
    }
  }

  private addSignpost(): void {
    const x = 3.4
    const z = -1.6
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.6, 7), flat(PALETTE.trunk))
    post.position.set(x, 1.3, z)
    post.castShadow = true
    this.scene.add(post)
    const signs: Array<[string, string]> = [
      ['Поляна', '#ff9a6b'],
      ['Пруд', '#7cc7ff'],
      ['Лес', '#9ed36a'],
      ['Дерево', '#ffd35c'],
    ]
    signs.forEach(([label, color], i) => {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.42),
        new THREE.MeshBasicMaterial({ map: signTexture(label, color), transparent: true, side: THREE.DoubleSide }),
      )
      const facing = Math.atan2(this.spawn.x - x, this.spawn.z - z)
      board.position.set(x + Math.sin(facing) * 0.22, 2.15 - i * 0.46, z + Math.cos(facing) * 0.22)
      board.rotation.y = facing
      this.scene.add(board)
    })
  }

  private addDecor(random: () => number): void {
    // Tree clusters keep paths and task spots readable.
    const clusters: Array<[number, number, number, number]> = [
      [-16, 4, 9, 12], [18, 4, 7, 6], [-2, 21, 8, 5], [0, -22, 10, 7], [22, -10, 7, 4], [-22, -12, 7, 4],
    ]
    for (const [cx, cz, spread, count] of clusters) {
      for (let i = 0; i < count; i += 1) {
        const a = random() * Math.PI * 2
        const d = 2 + random() * spread
        const x = cx + Math.cos(a) * d
        const z = cz + Math.sin(a) * d
        if (Math.hypot(x - this.spawn.x, z - this.spawn.z) < 7) continue
        if (this.nearNpc(x, z, 3.2)) continue
        this.addSmallTree(x, z, 0.75 + random() * 0.65, random)
      }
    }
    // Scattered meadow trees at the edges.
    for (let i = 0; i < 14; i += 1) {
      const a = random() * Math.PI * 2
      const d = 21 + random() * 6
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (this.nearNpc(x, z, 3.5) || Math.hypot(x - this.layout.landmark.x, z - this.layout.landmark.z) < 7) continue
      this.addSmallTree(x, z, 0.8 + random() * 0.5, random)
    }
    // Bushes and rocks.
    for (let i = 0; i < 26; i += 1) {
      const a = random() * Math.PI * 2
      const d = 5 + random() * 22
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (this.nearNpc(x, z, 2.4) || this.nearItem(x, z, 1.6)) continue
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + random() * 0.5, 0), flat(PALETTE.leaf[Math.floor(random() * PALETTE.leaf.length)]))
      bush.position.set(x, 0.35 + random() * 0.15, z)
      bush.scale.y = 0.75
      bush.rotation.set(random() * 0.3, random() * 3, random() * 0.3)
      bush.castShadow = true
      this.scene.add(bush)
    }
    for (let i = 0; i < 18; i += 1) {
      const a = random() * Math.PI * 2
      const d = 23 + random() * 5
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + random() * 0.6, 0), flat(random() > 0.5 ? PALETTE.stone : PALETTE.rock))
      rock.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d)
      rock.rotation.set(random(), random() * 3, random())
      rock.castShadow = true
      this.scene.add(rock)
    }
    // Flower meadow.
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 4), flat(new THREE.Color('#5aa84f')), 220)
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 0), flat(new THREE.Color('#ffffff')), 220)
    const dummy = new THREE.Object3D()
    let n = 0
    for (let i = 0; i < 260 && n < 220; i += 1) {
      const a = random() * Math.PI * 2
      const d = 3 + random() * 25
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (this.nearNpc(x, z, 2) || this.nearItem(x, z, 1.2) || Math.hypot(x - this.layout.water.center.x, z - this.layout.water.center.z) < this.layout.water.radius + 0.8) continue
      dummy.position.set(x, 0.15, z)
      dummy.rotation.set(0, random() * 3, 0)
      dummy.updateMatrix()
      stems.setMatrixAt(n, dummy.matrix)
      dummy.position.y = 0.33 + random() * 0.08
      dummy.scale.setScalar(0.8 + random() * 0.6)
      dummy.updateMatrix()
      heads.setMatrixAt(n, dummy.matrix)
      heads.setColorAt(n, new THREE.Color(PALETTE.flower[Math.floor(random() * PALETTE.flower.length)]))
      n += 1
    }
    stems.count = n
    heads.count = n
    stems.castShadow = heads.castShadow = true
    this.scene.add(stems, heads)

    // Decorative mushrooms in the forest.
    const mushroomAt = this.layout.npcSpots.mushroom!
    for (let i = 0; i < 14; i += 1) {
      const a = random() * Math.PI * 2
      const d = 4 + random() * 9
      const x = mushroomAt.x + Math.cos(a) * d
      const z = mushroomAt.z + Math.sin(a) * d
      if (this.nearNpc(x, z, 1.6)) continue
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18 + random() * 0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(new THREE.Color('#ff8a6b')))
      cap.position.set(x, 0.24, z)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 6), flat(new THREE.Color('#fff0d4')))
      stem.position.set(x, 0.12, z)
      this.scene.add(cap, stem)
    }
  }

  private addBoundary(random: () => number): void {
    const count = 56
    const radius = this.layout.playableRadius + 1
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
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + random() * 0.5, 0), flat(PALETTE.leaf[i % 4]))
        bush.position.set(Math.cos(a) * (radius - 0.2), 0.8, Math.sin(a) * (radius - 0.2))
        bush.scale.y = 0.9
        bush.castShadow = true
        this.scene.add(bush)
      }
    }
  }

  private addClouds(random: () => number): void {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true })
    for (let i = 0; i < 24; i += 1) {
      const cloud = new THREE.Group()
      const puffs = 3 + Math.floor(random() * 4)
      for (let p = 0; p < puffs; p += 1) {
        const puff = new THREE.Mesh(shadeCloud(new THREE.IcosahedronGeometry(1.5 + random() * 1.8, 1)), mat)
        puff.position.set(p * 1.7 - puffs * 0.85, random() * 0.9, (random() - 0.5) * 1.8)
        puff.scale.y = 0.6
        cloud.add(puff)
      }
      const low = random() < 0.55
      cloud.position.set((random() - 0.5) * 260, low ? -12 - random() * 14 : 22 + random() * 18, (random() - 0.5) * 220)
      cloud.scale.setScalar(low ? 2.6 + random() * 2 : 1.3 + random())
      cloud.userData.speed = 0.5 + random() * 0.8
      this.clouds.push(cloud)
      this.scene.add(cloud)
    }
  }

  private addDistantIslands(random: () => number): void {
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2 + random() * 0.4
      const dist = 95 + random() * 40
      const r = 4 + random() * 5.5
      const group = new THREE.Group()
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.93, 1.4, 16), flat(new THREE.Color('#75c866')))
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.78, 1.1, 16), flat(new THREE.Color('#5da653')))
      rim.position.y = -1.2
      const under = new THREE.ConeGeometry(r * 0.78, r * 1.35, 10, 2)
      jitter(under, random, r * 0.1)
      const rock = new THREE.Mesh(under, new THREE.MeshBasicMaterial({ color: '#8a6852' }))
      rock.rotation.x = Math.PI
      rock.position.y = -1.7 - r * 0.675
      group.add(top, rim, rock)
      // Tiny tree silhouettes make the far islands read as places, not floating drills.
      const trees = 2 + Math.floor(random() * 3)
      for (let t = 0; t < trees; t += 1) {
        const a = random() * Math.PI * 2
        const d = random() * r * 0.55
        const tree = new THREE.Group()
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 5), flat(new THREE.Color('#7a5a3d')))
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.1, 7), flat(new THREE.Color(t % 2 ? '#4d9b4b' : '#65b85a')))
        trunk.position.y = 0.7
        crown.position.y = 2.0
        tree.add(trunk, crown)
        tree.position.set(Math.cos(a) * d, 0.7, Math.sin(a) * d)
        tree.scale.setScalar(0.75 + random() * 0.55)
        group.add(tree)
      }
      const puffMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.65 })
      for (let p = 0; p < 3; p += 1) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + random() * 1.2, 1), puffMat)
        puff.position.set((random() - 0.5) * r * 1.2, -2.2 - random() * 1.6, (random() - 0.5) * r * 1.2)
        puff.scale.y = 0.55
        group.add(puff)
      }
      group.position.set(Math.cos(angle) * dist, -5 + random() * 20, Math.sin(angle) * dist)
      this.scene.add(group)
    }
  }

  private addButterflies(random: () => number): void {
    const colors = ['#ff9ab5', '#ffd35c', '#b79cff', '#8ed6ff']
    for (let i = 0; i < 9; i += 1) {
      const root = new THREE.Group()
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide })
      const wings = [
        new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), mat),
        new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), mat),
      ]
      wings[0].position.x = -0.11
      wings[1].position.x = 0.11
      wings[0].rotation.y = Math.PI / 2
      wings[1].rotation.y = -Math.PI / 2
      root.add(...wings)
      const center = new THREE.Vector3(-8 + random() * 16, 0, -8 + random() * 16)
      root.position.set(center.x, 1.2, center.z)
      this.scene.add(root)
      this.butterflies.push({ root, wings, center, phase: random() * Math.PI * 2, radius: 1.5 + random() * 2.5, height: 0.9 + random() * 1.2 })
    }
  }

  private addFireflies(random: () => number): void {
    const tex = haloTexture()
    for (let i = 0; i < 16; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#fff0a0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }))
      sprite.scale.setScalar(0.35 + random() * 0.25)
      const home = new THREE.Vector3(
        this.layout.water.center.x + (random() - 0.5) * 9,
        0.6 + random() * 1.2,
        this.layout.water.center.z + (random() - 0.5) * 9,
      )
      sprite.position.copy(home)
      this.scene.add(sprite)
      this.fireflies.push({ sprite, home, phase: random() * Math.PI * 2 })
    }
  }

  private nearNpc(x: number, z: number, d: number): boolean {
    return Object.values(this.layout.npcSpots).some(p => !!p && Math.hypot(p.x - x, p.z - z) < d)
  }

  private nearItem(x: number, z: number, d: number): boolean {
    return Object.values(this.layout.itemSpots).flatMap(spots => spots ?? []).some(p => Math.hypot(p.x - x, p.z - z) < d)
  }

  private makeFlower(random: () => number): THREE.Group {
    const group = new THREE.Group()
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.32, 4), flat(new THREE.Color('#5aa84f')))
    stem.position.y = 0.16
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), flat(new THREE.Color(PALETTE.flower[Math.floor(random() * PALETTE.flower.length)])))
    head.position.y = 0.36
    group.add(stem, head)
    return group
  }

  private addSmallTree(x: number, z: number, scale: number, random: () => number): void {
    const tree = new THREE.Group()
    tree.position.set(x, 0, z)
    tree.scale.setScalar(scale)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 7), flat(PALETTE.trunk))
    trunk.position.y = 0.65
    trunk.castShadow = true
    tree.add(trunk)
    const leafColor = PALETTE.leaf[Math.floor(random() * PALETTE.leaf.length)]
    for (let i = 0; i < 2; i += 1) {
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 - i * 0.22, 0), flat(leafColor))
      leaves.position.set((random() - 0.5) * 0.25, 1.5 + i * 0.65, (random() - 0.5) * 0.25)
      leaves.rotation.set(random(), random(), random())
      leaves.castShadow = true
      tree.add(leaves)
    }
    this.scene.add(tree)
    this.physics.addStaticCylinder(new THREE.Vector3(x, 1.4 * scale, z), 0.26 * scale, 2.8 * scale)
  }
}

function shadeCloud(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.attributes.position
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox!
  const colors = new Float32Array(pos.count * 3)
  const top = new THREE.Color('#ffffff')
  const bottom = new THREE.Color('#d7e3f5')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i += 1) {
    c.lerpColors(bottom, top, (pos.getY(i) - min.y) / (max.y - min.y))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

/** Build the world for a level. Both worlds share the same small gameplay contract. */
export function createWorld(physics: Physics, shadowMapSize: number, props: Record<PropKey, GLTF>, level: LevelId): WorldView {
  return level === 'planet'
    ? new PlanetWorld(physics, shadowMapSize, PLANET_LAYOUT)
    : new IslandWorld(physics, shadowMapSize, props, ISLAND_LAYOUT)
}
