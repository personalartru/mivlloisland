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

  /** Simple fallback body used only if the character model could not be loaded. */
  private buildPlaceholder(): void {
    const fur = new THREE.MeshStandardMaterial({ color: '#5fc7c9', roughness: 0.8 })
    const cream = new THREE.MeshStandardMaterial({ color: '#fff1d4', roughness: 0.9 })
    const dark = new THREE.MeshStandardMaterial({ color: '#3a2e4f', roughness: 0.5 })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.3, 6, 14), fur)
    body.position.y = 0.78
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), fur)
    head.scale.set(1.08, 0.92, 0.95)
    head.position.set(0, 1.22, -0.08)
    const earGeo = new THREE.ConeGeometry(0.19, 0.42, 4)
    for (const x of [-0.27, 0.27]) {
      const ear = new THREE.Mesh(earGeo, fur)
      ear.position.set(x, 1.59, -0.05)
      ear.rotation.y = Math.PI / 4
      this.placeholder.add(ear)
    }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 8, 16, Math.PI * 1.35), fur)
    tail.position.set(0, 0.72, 0.36)
    tail.rotation.set(Math.PI / 2, 0, Math.PI * 0.15)
    this.placeholder.add(tail)
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), cream)
    belly.position.set(0, 0.68, -0.25)
    const eyeGeo = new THREE.SphereGeometry(0.06, 10, 8)
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, dark)
      eye.position.set(x, 1.27, -0.43)
      this.placeholder.add(eye)
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), dark)
    nose.scale.set(1.1, .75, .7)
    nose.position.set(0, 1.16, -0.48)
    this.placeholder.add(nose)
    const whiskerGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6)
    for (const x of [-0.16, 0.16]) for (const y of [1.12, 1.18]) {
      const whisker = new THREE.Mesh(whiskerGeo, cream)
      whisker.position.set(x, y, -0.45)
      whisker.rotation.z = x < 0 ? -0.22 : 0.22
      whisker.rotation.x = Math.PI / 2
      this.placeholder.add(whisker)
    }
    const footGeo = new THREE.SphereGeometry(0.14, 12, 8)
    for (const x of [-0.22, 0.22]) for (const z of [-0.2, 0.16]) {
      const foot = new THREE.Mesh(footGeo, cream)
      foot.scale.set(1.1, 0.58, 1.3)
      foot.position.set(x, .42, z)
      this.placeholder.add(foot)
      this.paws.push(foot)
    }
    for (const m of [body, head, belly, tail]) m.castShadow = true
    this.placeholder.add(body, head, belly)
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
