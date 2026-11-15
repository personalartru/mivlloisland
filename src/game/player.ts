import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RAPIER, type Physics } from '../engine/physics'
import { CONFIG } from './config'
import { instantiate } from './models'
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
    const visual = instantiate(gltf, { height: 1.55, skeleton: true })
    // glTF faces +Z while the controller treats local -Z as forward.
    visual.rotation.y = Math.PI
    this.model.add(visual)
    this.placeholder.visible = false
    this.mixer = new THREE.AnimationMixer(visual)
    const clips = gltf.animations.map(clip => stripHorizontalRootMotion(clip.clone()))
    const idle = clips.find(clip => /idle|stand|relax/i.test(clip.name)) ?? clips[0]
    const walk = clips.find(clip => /walk|run/i.test(clip.name)) ?? clips[1]
    if (idle) {
      this.idleAction = this.mixer.clipAction(idle)
      this.idleAction.play()
      this.idleAction.setEffectiveWeight(1)
    }
    if (walk) {
      this.walkAction = this.mixer.clipAction(walk)
      this.walkAction.play()
      this.walkAction.setEffectiveWeight(0)
    }
  }

  /** Simple fallback body used only if the character model could not be loaded. */
  private buildPlaceholder(): void {
    const fur = new THREE.MeshStandardMaterial({ color: '#5fc7c9', roughness: 0.8 })
    const cream = new THREE.MeshStandardMaterial({ color: '#fff1d4', roughness: 0.9 })
    const dark = new THREE.MeshStandardMaterial({ color: '#3a2e4f', roughness: 0.5 })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.3, 6, 14), fur)
    body.position.y = 0.78
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), cream)
    belly.position.set(0, 0.68, -0.25)
    const eyeGeo = new THREE.SphereGeometry(0.06, 10, 8)
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(eyeGeo, dark)
      eye.position.set(x, 1.12, -0.32)
      this.placeholder.add(eye)
    }
    const footGeo = new THREE.SphereGeometry(0.14, 10, 8)
    for (const x of [-0.17, 0.17]) {
      const foot = new THREE.Mesh(footGeo, cream)
      foot.scale.set(1, 0.55, 1.25)
      foot.position.set(x, 0.12, -0.03)
      this.placeholder.add(foot)
    }
    for (const m of [body, belly]) m.castShadow = true
    this.placeholder.add(body, belly)
  }
}

/** Remove horizontal travel from root/hip position tracks while keeping vertical bounce and limbs. */
function stripHorizontalRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.map(track => {
    if (!track.name.endsWith('.position') || !/(root|hips|pelvis)/i.test(track.name)) return track
    const values = Array.from(track.values as ArrayLike<number>)
    const x0 = values[0]
    const z0 = values[2]
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0
      values[i + 2] = z0
    }
    return new THREE.VectorKeyframeTrack(track.name, Array.from(track.times as ArrayLike<number>), values)
  })
  return clip
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * (1 - Math.exp(-lambda * dt))
}
