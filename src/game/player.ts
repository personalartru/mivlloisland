import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RAPIER, type Physics } from '../engine/physics'
import { CONFIG } from './config'
import { tuning } from './tuning'

export type PlayerIntent = { moveX: number; moveY: number; sprint: boolean; jumpPressed: boolean; jumpHeld: boolean }
export type PlayerEvent = { type: 'jump' } | { type: 'land'; impact: number }

const P = CONFIG.player
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Third-person character on Rapier's KinematicCharacterController. The logical body owns all
 * movement; the animated visual is pinned to it and only bobs vertically. Walk/idle clips play
 * in place, with horizontal root/hip travel stripped so the mesh can never slide ahead of the body.
 */
export class Player {
  readonly root = new THREE.Group()
  readonly body: RAPIER.RigidBody
  readonly collider: RAPIER.Collider
  readonly velocity = new THREE.Vector3()
  grounded = false
  facing = 0
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly model = new THREE.Group()
  private readonly placeholder = new THREE.Group()
  private readonly paws: THREE.Mesh[] = []
  private mixer?: THREE.AnimationMixer
  private idleAction?: THREE.AnimationAction
  private walkAction?: THREE.AnimationAction
  private walkWeight = 0
  private readonly shadow: THREE.Mesh
  private coyote = 0
  private jumpBuffer = 0
  private jumping = false
  private squash = 0
  private runCycle = 0
  /** Last position where the player stood on solid ground (gentle respawn after a fall). */
  readonly safe = new THREE.Vector3()
  private safeTimer = 0

  constructor(private readonly physics: Physics, spawn: THREE.Vector3, gltf?: GLTF | null) {
    const world = physics.world
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(P.halfHeight, P.radius).setFriction(0), this.body)
    this.controller = world.createCharacterController(0.02)
    this.controller.enableAutostep(0.45, 0.25, false)
    this.controller.enableSnapToGround(0.4)
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50))
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(35))
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.safe.copy(spawn)

    this.root.position.copy(spawn)
    this.model.rotation.order = 'YXZ'
    this.root.add(this.model)
    this.buildPlaceholder()
    // The physics body is centred at the capsule midpoint. Move the visual cat down so
    // the paw soles sit at the capsule's lower edge instead of floating above the ground.
    this.placeholder.position.y = -(P.halfHeight + P.radius) - .3
    this.model.add(this.placeholder)
    if (gltf) this.useModel(gltf)
    physics.bind(this.body, this.root)

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(P.radius * 1.35, 24),
      new THREE.MeshBasicMaterial({ color: '#2f3d2a', transparent: true, opacity: 0.3, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.renderOrder = 1
  }

  get shadowMesh(): THREE.Mesh {
    return this.shadow
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y, t.z)
  }

  /** One fixed step. `cameraYaw` makes stick/WASD movement camera-relative. */
  step(dt: number, intent: PlayerIntent, cameraYaw: number, events: PlayerEvent[], speedMultiplier = 1): void {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3().crossVectors(forward, UP)
    const wish = new THREE.Vector3().addScaledVector(right, intent.moveX).addScaledVector(forward, intent.moveY)
    const wishLen = Math.min(1, wish.length())
    if (wishLen > 0.01) wish.normalize()

    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt)
    this.jumpBuffer = intent.jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt)

    const speed = (intent.sprint ? P.sprintSpeed : P.walkSpeed) * speedMultiplier * wishLen
    const control = this.grounded ? 1 : P.airControl
    const target = wish.clone().multiplyScalar(speed)
    const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
    horizontal.lerp(target, 1 - Math.exp(-(P.acceleration / 6) * control * dt))
    this.velocity.x = horizontal.x
    this.velocity.z = horizontal.z

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      tuning.activate('jump')
      this.velocity.y = P.jumpSpeed
      this.jumping = true
      this.jumpBuffer = 0
      this.coyote = 0
      this.grounded = false
      this.squash = -0.32
      events.push({ type: 'jump' })
    }
    const rising = this.velocity.y > 0
    const gravity = rising && this.jumping && !intent.jumpHeld ? P.lowJumpGravity : P.gravity
    this.velocity.y = Math.max(P.maxFall, this.velocity.y + gravity * dt)

    if (wishLen > 0.1) {
      const targetYaw = Math.atan2(-wish.x, -wish.z)
      this.facing = dampAngle(this.facing, targetYaw, P.turnSpeed, dt)
    }

    const desired = this.velocity.clone().multiplyScalar(dt)
    this.controller.computeColliderMovement(this.collider, desired)
    const moved = this.controller.computedMovement()
    const wasGrounded = this.grounded
    this.grounded = this.controller.computedGrounded()

    if (this.velocity.y > 0 && moved.y < desired.y - 1e-3) this.velocity.y = 0
    if (this.grounded) {
      if (!wasGrounded && this.velocity.y < -5) {
        events.push({ type: 'land', impact: Math.min(1, -this.velocity.y / 28) })
        this.squash = Math.min(0.4, -this.velocity.y / 55)
      }
      if (this.velocity.y < 0) this.velocity.y = -1
      this.jumping = false
    }

    const cur = this.body.translation()
    const next = { x: cur.x + moved.x, y: cur.y + moved.y, z: cur.z + moved.z }
    this.body.setNextKinematicTranslation(next)

    if (this.grounded) {
      this.safeTimer += dt
      if (this.safeTimer > 0.4) this.safe.set(next.x, next.y + 0.2, next.z)
    } else {
      this.safeTimer = 0
    }
  }

  /** Teleport (spawn, respawn). Clears velocity and interpolation so the camera does not streak. */
  teleport(to: THREE.Vector3): void {
    this.body.setTranslation(to, true)
    this.body.setNextKinematicTranslation(to)
    this.velocity.set(0, 0, 0)
    this.root.position.copy(to)
    this.physics.snap(this.body)
  }

  /** Visual-only animation, once per rendered frame after `physics.sync()`. */
  animate(frameSeconds: number, ground: number | null): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    this.model.rotation.y = this.facing
    this.squash = THREE.MathUtils.damp(this.squash, 0, 10, frameSeconds)
    const stretch = this.grounded ? 0 : THREE.MathUtils.clamp(this.velocity.y / 55, -0.1, 0.16)
    const s = 1 - this.squash + stretch
    this.model.scale.set(1 / Math.sqrt(Math.max(s, 0.5)), s, 1 / Math.sqrt(Math.max(s, 0.5)))

    if (this.mixer) {
      const walking = this.grounded && speed > 0.35
      this.walkWeight = THREE.MathUtils.damp(this.walkWeight, walking ? 1 : 0, 9, frameSeconds)
      this.walkAction?.setEffectiveWeight(this.walkWeight)
      this.idleAction?.setEffectiveWeight(1 - this.walkWeight * 0.85)
      if (this.walkAction) this.walkAction.timeScale = THREE.MathUtils.clamp(speed / P.walkSpeed, 0.7, 2.1)
      this.mixer.update(frameSeconds)
      this.model.position.y = 0
      this.model.rotation.x = -Math.min(0.12, speed / 70)
    } else {
      if (this.grounded && speed > 0.5) this.runCycle += frameSeconds * speed * 1.8
      const bob = this.grounded ? Math.abs(Math.sin(this.runCycle)) * 0.07 * Math.min(1, speed / 6) : 0
      this.model.position.y = bob
      this.model.rotation.x = -Math.min(0.2, speed / 50)
      const stride = this.grounded && speed > 0.35 ? Math.sin(this.runCycle) * 0.045 : 0
      for (const [i, paw] of this.paws.entries()) paw.position.y = .42 + (i % 2 === 0 ? stride : -stride)
    }

    // Blob shadow: a friendly depth cue even when real shadows are disabled.
    if (ground === null) {
      this.shadow.visible = false
    } else {
      const feet = this.root.position.y - P.halfHeight - P.radius
      const height = Math.max(0, feet - ground)
      this.shadow.visible = height < 12
      this.shadow.position.set(this.root.position.x, ground + 0.03, this.root.position.z)
      const k = THREE.MathUtils.clamp(1 - height / 12, 0.3, 1)
      this.shadow.scale.setScalar(k)
      ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * k
    }
  }

  private useModel(gltf: GLTF): void {
    // The bundled model reads as a seal/ball in close-up. Keep the gameplay model
    // deliberately procedural so Murzik is unmistakably a cat in every level.
    void gltf
  }

  /** Pastel plush-like cat assembled from simple geometry, independent of loaded model assets. */
  private buildPlaceholder(): void {
    const fur = new THREE.MeshStandardMaterial({ color: '#d895b7', roughness: 0.96 })
    const blush = new THREE.MeshStandardMaterial({ color: '#f0b8c9', roughness: 0.94 })
    const cream = new THREE.MeshStandardMaterial({ color: '#f6e3d5', roughness: 0.96 })
    const lavender = new THREE.MeshStandardMaterial({ color: '#b38bc9', roughness: 0.96 })
    const innerEar = new THREE.MeshStandardMaterial({ color: '#c87f9e', roughness: 0.9 })
    const eyeWhite = new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: 0.32 })
    const iris = new THREE.MeshStandardMaterial({ color: '#77a675', roughness: 0.3 })
    const pupil = new THREE.MeshStandardMaterial({ color: '#17232a', roughness: 0.22 })
    const noseMaterial = new THREE.MeshStandardMaterial({ color: '#503342', roughness: 0.45 })
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#553243', roughness: 0.65 })
    const tongueMaterial = new THREE.MeshStandardMaterial({ color: '#e789a6', roughness: 0.65 })
    const eyeGlint = new THREE.MeshBasicMaterial({ color: '#fffef7' })
    const noteMaterial = new THREE.MeshStandardMaterial({
      color: '#fff1c4', emissive: '#ffcf74', emissiveIntensity: 0.28, roughness: 0.4,
    })

    const add = (mesh: THREE.Mesh): THREE.Mesh => {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.placeholder.add(mesh)
      return mesh
    }
    const ball = (radius: number, material: THREE.Material, x: number, y: number, z: number,
      sx = 1, sy = 1, sz = 1): THREE.Mesh => {
      const mesh = add(new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material))
      mesh.position.set(x, y, z)
      mesh.scale.set(sx, sy, sz)
      return mesh
    }
    const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 18): THREE.Mesh => {
      const path = new THREE.CatmullRomCurve3(points)
      return add(new THREE.Mesh(new THREE.TubeGeometry(path, segments, radius, 6, false), material))
    }

    // Big soft head, round body and a pale chest patch echo the supplied plush-cat reference.
    ball(0.46, fur, 0, 0.73, 0.03, 1.08, 1.16, 0.92)
    ball(0.46, fur, 0, 1.28, -0.05, 1.08, 0.98, 0.91)
    ball(0.29, cream, 0, 0.70, -0.37, 0.76, 1.04, 0.22)
    for (const x of [-0.25, 0.25]) ball(0.19, blush, x, 1.17, -0.37, 1.08, 0.72, 0.55)

    // Small rounded ears with warm inner patches.
    for (const x of [-0.29, 0.29]) {
      const ear = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 8), fur))
      ear.position.set(x, 1.57, -0.035)
      ear.rotation.z = x < 0 ? -0.16 : 0.16
      const inner = add(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.20, 8), innerEar))
      inner.position.set(x, 1.57, -0.155)
      inner.rotation.z = ear.rotation.z
    }

    // Oversized green eyes with layered irises and catchlights.
    for (const x of [-0.19, 0.19]) {
      ball(0.128, eyeWhite, x, 1.33, -0.435, 1, 1.05, 0.62)
      ball(0.087, iris, x, 1.33, -0.522, 1, 1.02, 0.62)
      ball(0.049, pupil, x, 1.33, -0.579, 0.9, 1.08, 0.58)
      ball(0.021, eyeGlint, x - 0.026, 1.365, -0.615, 1, 1, 0.7)
      ball(0.009, eyeGlint, x + 0.026, 1.305, -0.61, 1, 1, 0.7)
    }
    ball(0.052, noseMaterial, 0, 1.18, -0.55, 1.2, 0.72, 0.7)
    ball(0.036, mouthMaterial, 0, 1.115, -0.555, 0.82, 1.08, 0.55)
    ball(0.018, tongueMaterial, 0, 1.091, -0.585, 0.9, 0.65, 0.55)

    // Fine whiskers and three cream marks on the forehead.
    for (const side of [-1, 1]) {
      for (const offset of [-0.035, 0, 0.035]) {
        tube([
          new THREE.Vector3(side * 0.31, 1.17 + offset, -0.48),
          new THREE.Vector3(side * 0.42, 1.18 + offset * 1.5, -0.43),
          new THREE.Vector3(side * 0.51, 1.20 + offset * 2, -0.36),
        ], 0.006, cream, 8)
      }
    }
    const headFrontZ = (x: number, y: number): number =>
      -0.05 - 0.419 * Math.sqrt(Math.max(0.05, 1 - (x / 0.497) ** 2 - ((y - 1.28) / 0.451) ** 2)) - 0.006
    const headBackZ = (x: number, y: number): number =>
      -0.05 + 0.419 * Math.sqrt(Math.max(0.05, 1 - (x / 0.497) ** 2 - ((y - 1.28) / 0.451) ** 2)) + 0.006
    for (const x of [-0.065, 0, 0.065]) {
      tube([1.60, 1.52, 1.44].map(y => new THREE.Vector3(x, y, headFrontZ(x, y))), 0.012, cream, 10)
      tube([1.60, 1.52, 1.44].map(y => new THREE.Vector3(x, y, headBackZ(x, y))), 0.012, cream, 10)
    }

    // Soft horizontal bands across the back and a fluffy tail with a turquoise tip.
    const backStripe = new THREE.MeshStandardMaterial({ color: '#f6dfdc', roughness: 0.98 })
    for (const [index, y] of [0.55, 0.71, 0.87].entries()) {
      const stripeMaterial = index === 1 ? lavender : backStripe
      const points = [-0.27, -0.135, 0, 0.135, 0.27].map(x => {
        const surface = Math.sqrt(Math.max(0.05, 1 - (x / 0.497) ** 2 - ((y - 0.73) / 0.534) ** 2))
        return new THREE.Vector3(x, y, 0.03 + 0.423 * surface + 0.006)
      })
      tube(points, 0.016, stripeMaterial, 20)
    }
    tube([
      new THREE.Vector3(0.04, 0.69, 0.36),
      new THREE.Vector3(0.25, 0.64, 0.48),
      new THREE.Vector3(0.48, 0.67, 0.51),
      new THREE.Vector3(0.66, 0.77, 0.42),
    ], 0.105, lavender, 24)
    ball(0.135, new THREE.MeshStandardMaterial({ color: '#72c7c0', roughness: 0.9 }), 0.66, 0.77, 0.42, 1.05, 1, 1)

    // A tiny glowing music-note emblem is visible on the chest when the cat turns.
    ball(0.054, noteMaterial, -0.045, 0.60, -0.434, 1.1, 0.7, 0.3)
    const noteStem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), noteMaterial))
    noteStem.position.set(0.035, 0.73, -0.434)
    tube([
      new THREE.Vector3(0.035, 0.84, -0.434),
      new THREE.Vector3(0.095, 0.81, -0.434),
      new THREE.Vector3(0.12, 0.75, -0.434),
    ], 0.014, noteMaterial, 8)

    // Four short, rounded paws keep the existing gait and ground contact unchanged.
    for (const x of [-0.22, 0.22]) for (const z of [-0.16, 0.18]) {
      const paw = ball(0.15, cream, x, 0.42, z, 1.12, 0.62, 1.3)
      this.paws.push(paw)
    }
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
