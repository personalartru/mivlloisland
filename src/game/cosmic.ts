import * as THREE from 'three'
import type { ItemKind, QuestId } from './content'
import type { NpcVisual } from './visual-types'

/**
 * Hand-built low-poly inhabitants and wonders of Планета Звёздная. They are modelled from
 * primitives on purpose: the planet is a crystal world, so faceted emissive shapes read better
 * than earthly textures, and the level stays lightweight on tablets.
 *
 * Every character faces +Z, matching the glTF convention used by the island residents, and is
 * normalised to its gameplay height with feet on y = 0.
 */

// ─── materials ──────────────────────────────────────────────────────────────

const skin = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.62, metalness: 0.04, ...extra })

const shine = (color: string, intensity = 1.05) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.32, metalness: 0 })

const glass = (color: string, opacity = 0.55) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity, roughness: 0.2, depthWrite: false })

const INK = '#241a3f'

function eyes(parent: THREE.Object3D, y: number, z: number, spread = 0.14, size = 0.055): void {
  const white = shine('#ffffff', 0.4)
  const dark = skin(INK, { roughness: 0.35 })
  for (const x of [-spread, spread]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), dark)
    eye.position.set(x, y, z)
    const spark = new THREE.Mesh(new THREE.SphereGeometry(size * 0.34, 8, 6), white)
    spark.position.set(x + size * 0.35, y + size * 0.35, z + size * 0.7)
    parent.add(eye, spark)
  }
}

function smile(parent: THREE.Object3D, y: number, z: number, radius = 0.1): void {
  const curve = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 6, 12, Math.PI), skin(INK))
  curve.position.set(0, y, z)
  curve.rotation.z = Math.PI
  parent.add(curve)
}

function cheeks(parent: THREE.Object3D, y: number, z: number, spread = 0.2): void {
  const mat = new THREE.MeshStandardMaterial({ color: '#ff9ec4', transparent: true, opacity: 0.75, roughness: 0.8 })
  for (const x of [-spread, spread]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat)
    cheek.scale.set(1, 0.7, 0.4)
    cheek.position.set(x, y, z)
    parent.add(cheek)
  }
}

/** Scale a freshly built model to `height`, centre it on x/z and stand it on y = 0. */
export function fitToHeight(object: THREE.Object3D, height: number): THREE.Group {
  const holder = new THREE.Group()
  holder.add(object)
  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const scale = height / Math.max(size.y, 1e-4)
  object.scale.multiplyScalar(scale)
  object.updateMatrixWorld(true)
  const scaled = new THREE.Box3().setFromObject(object)
  const center = scaled.getCenter(new THREE.Vector3())
  object.position.x -= center.x
  object.position.z -= center.z
  object.position.y -= scaled.min.y
  return holder
}

function shadowed(group: THREE.Object3D): void {
  group.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

// ─── characters ─────────────────────────────────────────────────────────────

/** Люмо — a crystal child whose heart dimmed; he asks for stardust. */
function buildLumo(): THREE.Group {
  const g = new THREE.Group()
  const crystal = new THREE.MeshStandardMaterial({
    color: '#8fe4ff', emissive: '#2f9fe8', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.15,
    transparent: true, opacity: 0.9, flatShading: true,
  })
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystal)
  body.scale.set(1, 1.18, 0.94)
  body.position.y = 0.78
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), crystal)
  head.scale.set(1, 1.06, 0.95)
  head.position.y = 1.38
  g.add(body, head)

  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), shine('#ffe9a8', 1.2))
  heart.position.set(0, 0.8, 0.22)
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), glass('#ffe9a8', 0.08))
  aura.position.copy(heart.position)
  g.add(heart, aura)

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), new THREE.MeshStandardMaterial({
    color: '#c9f6ff', emissive: '#6fd8ff', emissiveIntensity: 0.25, roughness: 0.25, transparent: true, opacity: 0.55,
  }))
  face.scale.set(1, 0.82, 0.4)
  face.position.set(0, 1.38, 0.2)
  g.add(face)
  eyes(g, 1.4, 0.37, 0.13, 0.052)
  cheeks(g, 1.3, 0.33, 0.18)
  smile(g, 1.27, 0.38, 0.07)

  const armGeo = new THREE.OctahedronGeometry(0.16, 0)
  for (const x of [-0.56, 0.56]) {
    const arm = new THREE.Mesh(armGeo, crystal)
    arm.position.set(x, 0.92, 0)
    arm.scale.set(0.8, 1.5, 0.8)
    g.add(arm)
  }
  const legGeo = new THREE.ConeGeometry(0.11, 0.32, 5)
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(legGeo, crystal)
    leg.position.set(x, 0.16, 0)
    g.add(leg)
  }
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), shine('#bff3ff', 1.0))
    crown.position.set((i - 1) * 0.14, 1.72 + (i === 1 ? 0.05 : 0), 0)
    g.add(crown)
  }

  const orbit = new THREE.Group()
  orbit.position.y = 0.95
  for (let i = 0; i < 3; i += 1) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), shine('#a9ecff', 0.9))
    const a = (i / 3) * Math.PI * 2
    shard.position.set(Math.cos(a) * 0.82, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.82)
    orbit.add(shard)
  }
  g.add(orbit)

  const tick = (t: number) => {
    orbit.rotation.y = t * 0.9
    orbit.position.y = 0.95 + Math.sin(t * 1.6) * 0.06
    const pulse = 1 + Math.sin(t * 2.4) * 0.12
    heart.scale.setScalar(pulse)
    ;(aura.material as THREE.MeshStandardMaterial).opacity = 0.12 + Math.sin(t * 2.4) * 0.05
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

/** БИП-7 — a hovering gardener robot with a crystal-seed nursery. */
function buildBip(): THREE.Group {
  const g = new THREE.Group()
  const shell = skin('#e9e6ff', { roughness: 0.45 })
  const trim = skin('#8f7ad6', { roughness: 0.4 })
  const mint = shine('#7ef0d0', 0.85)

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.46, 6, 16), shell)
  body.position.y = 0.92
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.06), skin('#2b2450', { roughness: 0.3 }))
  chest.position.set(0, 0.94, 0.33)
  const sproutStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), mint)
  sproutStem.position.set(0, 0.93, 0.37)
  const leafGeo = new THREE.SphereGeometry(0.05, 8, 6)
  const leafA = new THREE.Mesh(leafGeo, mint)
  leafA.scale.set(1, 0.5, 0.5)
  leafA.position.set(-0.04, 0.98, 0.37)
  leafA.rotation.z = 0.5
  const leafB = leafA.clone()
  leafB.position.x = 0.04
  leafB.rotation.z = -0.5
  g.add(body, chest, sproutStem, leafA, leafB)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), shell)
  head.position.y = 1.52
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin('#1b1533', { roughness: 0.2, metalness: 0.2 }))
  visor.scale.set(1.25, 0.78, 0.55)
  visor.position.set(0, 1.54, 0.19)
  g.add(head, visor)
  const eyeMat = shine('#8ff7ff', 1.5)
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat)
    eye.position.set(x, 1.56, 0.32)
    g.add(eye)
  }
  smile(g, 1.44, 0.33, 0.06)

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 6), trim)
  antenna.position.y = 1.86
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), shine('#ff9ae6', 1.4))
  bulb.position.y = 2.02
  g.add(antenna, bulb)

  for (const x of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), trim)
    shoulder.position.set(x * 0.34, 1.16, 0)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), shell)
    arm.position.set(x * 0.44, 0.98, 0.02)
    arm.rotation.z = x * 0.35
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mint)
    hand.position.set(x * 0.5, 0.8, 0.02)
    g.add(shoulder, arm, hand)
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 20), shine('#7ef0d0', 0.95))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.36
  const ringDark = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.06, 8, 20), trim)
  ringDark.rotation.x = Math.PI / 2
  ringDark.position.y = 0.34
  g.add(ringDark, ring)
  for (const x of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), trim)
    leg.position.set(x * 0.17, 0.16, 0)
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), shell)
    foot.scale.set(1, 0.6, 1.2)
    foot.position.set(x * 0.17, 0.04, 0.03)
    g.add(leg, foot)
  }

  const tick = (t: number) => {
    ring.rotation.z = t * 1.4
    const blink = (Math.sin(t * 3.1) + 1) / 2 > 0.86 ? 0.25 : 2.2
    ;(bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = blink
    head.rotation.y = Math.sin(t * 0.8) * 0.12
    visor.rotation.y = head.rotation.y
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

/** Гром — a space whale who filters nebula bubbles through his star fountain. */
function buildWhale(): THREE.Group {
  const g = new THREE.Group()
  const hide = skin('#6152c9', { roughness: 0.7 })
  const belly = skin('#dcd4ff', { roughness: 0.8 })
  const finMat = skin('#7a68e0', { roughness: 0.7 })

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), hide)
  body.scale.set(1, 0.8, 1.4)
  body.position.y = 1.15
  const tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), belly)
  tummy.scale.set(0.86, 0.5, 1.2)
  tummy.position.set(0, 0.86, 0.05)
  g.add(body, tummy)

  eyes(g, 1.32, 1.2, 0.5, 0.1)
  cheeks(g, 1.12, 1.2, 0.72)
  smile(g, 1.05, 1.36, 0.22)

  const finGeo = new THREE.ConeGeometry(0.3, 0.8, 6)
  const fins: THREE.Mesh[] = []
  for (const x of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, finMat)
    fin.position.set(x * 1.02, 0.92, 0.15)
    fin.rotation.z = x * 2.25
    fin.scale.set(1, 1.15, 0.45)
    fins.push(fin)
    g.add(fin)
  }

  const tail = new THREE.Group()
  tail.position.set(0, 1.1, -1.32)
  for (const x of [-1, 1]) {
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.95, 6), finMat)
    fluke.position.set(x * 0.28, 0.05, -0.4)
    fluke.rotation.x = -1.2
    fluke.rotation.z = x * 0.55
    fluke.scale.set(1, 1, 0.4)
    tail.add(fluke)
  }
  g.add(tail)

  for (let i = 0; i < 7; i += 1) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (i % 3) * 0.02, 8, 6), shine(i % 2 ? '#ffe07a' : '#9af7ff', 1.8))
    const a = (i / 7) * Math.PI * 2
    spot.position.set(Math.cos(a) * 0.62, 1.55 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.85 - 0.1)
    g.add(spot)
  }

  const spout = new THREE.Group()
  spout.position.set(0, 1.85, 0.35)
  const drops: THREE.Mesh[] = []
  for (let i = 0; i < 5; i += 1) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 2) * 0.03, 8, 6), shine(i % 2 ? '#ffd0f6' : '#9af7ff', 1.8))
    drop.position.set((i - 2) * 0.14, 0.1 + (i % 3) * 0.16, 0)
    drops.push(drop)
    spout.add(drop)
  }
  g.add(spout)

  const tick = (t: number) => {
    tail.rotation.y = Math.sin(t * 1.1) * 0.22
    tail.rotation.x = Math.sin(t * 0.9) * 0.08
    fins[0].rotation.z = 2.25 + Math.sin(t * 1.3) * 0.16
    fins[1].rotation.z = -2.25 - Math.sin(t * 1.3) * 0.16
    drops.forEach((drop, i) => {
      const k = (t * 0.5 + i * 0.2) % 1
      drop.position.y = 0.08 + k * 0.5
      ;(drop.material as THREE.MeshStandardMaterial).opacity = 1 - k * 0.7
    })
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

/** Тиара — keeper of the planet's rings, elegant and a little solemn. */
function buildKeeper(): THREE.Group {
  const g = new THREE.Group()
  const robe = skin('#6f52c4', { roughness: 0.75 })
  const trim = shine('#ff9ae6', 1.2)
  const pale = skin('#ffe8f8', { roughness: 0.6 })

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.3, 9), robe)
  skirt.position.y = 0.66
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 24), trim)
  hem.rotation.x = Math.PI / 2
  hem.position.y = 0.1
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.6, 10), robe)
  torso.position.y = 1.35
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 20), trim)
  collar.rotation.x = Math.PI / 2
  collar.position.y = 1.6
  g.add(skirt, hem, torso, collar)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), pale)
  head.position.y = 1.82
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skin('#b79cff', { roughness: 0.6 }))
  hair.scale.set(1, 0.85, 1)
  hair.position.set(0, 1.9, -0.06)
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin('#b79cff', { roughness: 0.6 }))
  bun.position.set(0, 1.98, -0.24)
  g.add(head, hair, bun)
  eyes(g, 1.84, 0.22, 0.09, 0.045)
  smile(g, 1.74, 0.23, 0.06)

  for (let i = 0; i < 5; i += 1) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), shine(i % 2 ? '#9af7ff' : '#ffd6f6', 1.8))
    const a = (i / 4 - 0.5) * 1.8
    gem.position.set(Math.sin(a) * 0.22, 2.04 + Math.cos(a) * 0.04, Math.cos(a) * 0.05)
    g.add(gem)
  }

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.014, 6, 32), shine('#ffd6f6', 1.2))
  halo.rotation.x = Math.PI / 2
  halo.position.y = 2.22
  g.add(halo)

  for (const x of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), robe)
    arm.position.set(x * 0.3, 1.3, 0.04)
    arm.rotation.z = x * 0.5
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), pale)
    hand.position.set(x * 0.44, 1.05, 0.08)
    g.add(arm, hand)
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20), shine('#9af7ff', 1.1))
  ring.position.set(0.46, 1.08, 0.1)
  ring.rotation.y = 0.4
  g.add(ring)

  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.012, 6, 48), glass('#ff9ae6', 0.45))
  aura.rotation.x = Math.PI / 2
  aura.position.y = 0.95
  g.add(aura)

  const tick = (t: number) => {
    halo.rotation.z = t * 0.7
    ring.rotation.y = 0.4 + t * 1.6
    aura.rotation.z = t * 0.25
    aura.position.y = 0.95 + Math.sin(t * 1.2) * 0.05
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

/** Искра — a comet kid who lost the sparks from her tail. */
function buildComet(): THREE.Group {
  const g = new THREE.Group()
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshStandardMaterial({
    color: '#ffd9a8', emissive: '#ff8a3c', emissiveIntensity: 0.9, roughness: 0.35, flatShading: true,
  }))
  core.position.y = 0.72
  g.add(core)

  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff9a4a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.7, 10, 1, true), tailMat)
  tail.rotation.x = -Math.PI / 2
  tail.position.set(0, 0.72, -0.9)
  const tailInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }))
  tailInner.rotation.x = -Math.PI / 2
  tailInner.position.set(0, 0.72, -0.72)
  g.add(tail, tailInner)

  eyes(g, 0.8, 0.34, 0.14, 0.055)
  cheeks(g, 0.68, 0.31, 0.2)
  smile(g, 0.66, 0.38, 0.075)

  for (const x of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 8), shine('#ffcf8a', 0.95))
    arm.position.set(x * 0.44, 0.72, 0.02)
    arm.rotation.z = x * 0.6
    g.add(arm)
  }

  const sparks = new THREE.Group()
  sparks.position.y = 0.72
  for (let i = 0; i < 6; i += 1) {
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), shine('#ffe07a', 1.25))
    const a = (i / 6) * Math.PI * 2
    spark.position.set(Math.cos(a) * 0.7, Math.sin(a * 3) * 0.18, Math.sin(a) * 0.7)
    sparks.add(spark)
  }
  g.add(sparks)

  const tick = (t: number) => {
    sparks.rotation.y = t * 1.3
    const flicker = 0.9 + Math.sin(t * 6) * 0.12
    tail.scale.set(flicker, 1 + Math.sin(t * 3.2) * 0.08, flicker)
    ;(tailMat).opacity = 0.4 + Math.sin(t * 5.5) * 0.08
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

/** Лунатик — a sleepy moon spirit who brews moon-flower tea. */
function buildLunatic(): THREE.Group {
  const g = new THREE.Group()
  const moon = skin('#fff3d6', { roughness: 0.85 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), moon)
  body.position.y = 0.78
  g.add(body)
  for (const [x, y, z, r] of [[-0.22, 0.95, 0.42, 0.11], [0.3, 0.7, 0.4, 0.08], [-0.36, 0.62, 0.3, 0.07]] as const) {
    const crater = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), skin('#e6d6b4', { roughness: 0.9 }))
    crater.scale.set(1, 1, 0.35)
    crater.position.set(x, y, z)
    g.add(crater)
  }
  for (const x of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 6), moon)
    ear.position.set(x * 0.28, 1.26, -0.02)
    ear.rotation.z = x * 0.35
    g.add(ear)
  }
  const eyeMat = skin(INK, { roughness: 0.4 })
  for (const x of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat)
    eye.scale.set(1, 0.32, 0.5)
    eye.position.set(x * 0.17, 0.84, 0.5)
    g.add(eye)
  }
  cheeks(g, 0.7, 0.45, 0.3)
  smile(g, 0.7, 0.5, 0.05)

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.5, 8), skin('#b79cff', { roughness: 0.7 }))
  cap.position.set(0.06, 1.34, -0.04)
  cap.rotation.z = -0.28
  const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), shine('#ffe07a', 1.0))
  pompom.position.set(0.2, 1.6, -0.04)
  const capStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), shine('#ffe07a', 1.15))
  capStar.position.set(-0.12, 1.36, 0.28)
  g.add(cap, pompom, capStar)

  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16, Math.PI * 1.25), shine('#fff6d0', 1.05))
  crescent.position.set(-0.7, 1.1, 0.15)
  crescent.rotation.z = 0.6
  g.add(crescent)

  const tick = (t: number) => {
    const a = t * 0.7
    crescent.position.set(Math.cos(a) * 0.78, 1.1 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.6 + 0.1)
    crescent.rotation.y = -a
  }
  g.userData.tick = tick
  shadowed(g)
  return g
}

const BUILDERS: Partial<Record<QuestId, { build: () => THREE.Group; height: number; bob?: number; hover?: number; collider?: number }>> = {
  lumo: { build: buildLumo, height: 1.62, bob: 0.05, hover: 0.06 },
  bip: { build: buildBip, height: 1.78, bob: 0.03, collider: 0.5 },
  whale: { build: buildWhale, height: 2.35, bob: 0.14, hover: 0.25, collider: 1.25 },
  keeper: { build: buildKeeper, height: 2.05, bob: 0.035, collider: 0.55 },
  comet: { build: buildComet, height: 1.45, bob: 0.1, hover: 0.22 },
  lunatic: { build: buildLunatic, height: 1.55, bob: 0.08, hover: 0.1 },
}

/** Visual recipe for a cosmic resident, or `undefined` when the id belongs to the island. */
export function cosmicNpcVisual(id: QuestId): NpcVisual | undefined {
  const recipe = BUILDERS[id]
  if (!recipe) return undefined
  return {
    height: recipe.height,
    bob: recipe.bob,
    hover: recipe.hover,
    collider: recipe.collider,
    build: () => {
      const model = recipe.build()
      const holder = fitToHeight(model, recipe.height)
      const tick = model.userData.tick as ((time: number) => void) | undefined
      holder.userData.tick = tick
      return holder
    },
    tick: (visual, time) => {
      const tick = visual.userData.tick as ((time: number) => void) | undefined
      tick?.(time)
    },
  }
}

// ─── collectibles ───────────────────────────────────────────────────────────

function buildStardust(): THREE.Group {
  const g = new THREE.Group()
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), shine('#ffd24a', 0.75))
  g.add(core)
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2
    const bit = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 + (i % 2) * 0.03, 0), shine('#ffe07a', 0.95))
    bit.position.set(Math.cos(a) * 0.26, Math.sin(a * 2) * 0.14, Math.sin(a) * 0.26)
    g.add(bit)
  }
  return g
}

function buildSeed(): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({
    color: '#7ef0d0', emissive: '#2fbfa0', emissiveIntensity: 0.5, roughness: 0.2, flatShading: true,
  }))
  shell.scale.set(1, 0.85, 1)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), shine('#b6ffe9', 0.95))
  tip.position.y = 0.24
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), skin('#8ff7b0', { roughness: 0.7 }))
  leaf.scale.set(1.6, 0.3, 0.7)
  leaf.position.set(0.16, 0.1, 0)
  leaf.rotation.z = 0.5
  g.add(shell, tip, leaf)
  return g
}

function buildNebula(): THREE.Group {
  const g = new THREE.Group()
  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), new THREE.MeshStandardMaterial({
    color: '#e56ac6', emissive: '#c94fb0', emissiveIntensity: 0.25, transparent: true, opacity: 0.6, roughness: 0.1, depthWrite: false,
  }))
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 6, 24), new THREE.MeshBasicMaterial({ color: '#c9a6ff', transparent: true, opacity: 0.8 }))
  swirl.rotation.set(1.1, 0.4, 0)
  g.add(outer, swirl)
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), shine('#fff6ff', 1.0))
    spark.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.3)
    g.add(spark)
  }
  g.userData.tick = (t: number) => {
    swirl.rotation.z = t * 1.1
    swirl.rotation.x = 1.1 + Math.sin(t * 0.9) * 0.2
  }
  return g
}

function buildShard(): THREE.Group {
  const g = new THREE.Group()
  const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.24, 0.72, 3), new THREE.MeshStandardMaterial({
    color: '#9ad8ff', emissive: '#3fa9ff', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.2, flatShading: true,
  }))
  shard.rotation.z = 0.22
  shard.position.y = 0.34
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), shine('#ffffff', 1.3))
  glint.position.set(0.16, 0.5, 0.1)
  g.add(shard, glint)
  return g
}

function buildSpark(): THREE.Group {
  const g = new THREE.Group()
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), shine('#ffb35c', 1.1))
  core.position.y = 0.3
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8, 1, true), new THREE.MeshBasicMaterial({
    color: '#ffd9a8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }))
  tail.rotation.x = Math.PI / 2
  tail.position.set(0, 0.3, -0.3)
  const bit = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), shine('#fff3b0', 1.35))
  bit.position.set(0.18, 0.46, 0.08)
  g.add(core, tail, bit)
  return g
}

function buildLunar(): THREE.Group {
  const g = new THREE.Group()
  const petalMat = new THREE.MeshStandardMaterial({ color: '#9a86e8', emissive: '#5a48b8', emissiveIntensity: 0.15, roughness: 0.65, flatShading: true })
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), petalMat)
    petal.scale.set(1, 0.28, 0.6)
    petal.position.set(Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2)
    petal.rotation.y = -a
    g.add(petal)
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), shine('#fff6d0', 0.8))
  center.position.y = 0.34
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), skin('#9a8cff', { roughness: 0.7 }))
  stem.position.y = 0.15
  g.add(center, stem)
  return g
}

const ITEM_BUILDERS: Partial<Record<ItemKind, { build: () => THREE.Group; height: number }>> = {
  stardust: { build: buildStardust, height: 0.56 },
  seed: { build: buildSeed, height: 0.62 },
  nebula: { build: buildNebula, height: 0.64 },
  shard: { build: buildShard, height: 0.72 },
  spark: { build: buildSpark, height: 0.58 },
  lunar: { build: buildLunar, height: 0.62 },
}

/** Build a cosmic collectible, or `undefined` when the kind belongs to the island. */
export function cosmicItem(kind: ItemKind): THREE.Group | undefined {
  const recipe = ITEM_BUILDERS[kind]
  if (!recipe) return undefined
  const model = recipe.build()
  const holder = fitToHeight(model, recipe.height)
  holder.userData.tick = model.userData.tick
  holder.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) mesh.castShadow = true
  })
  return holder
}
