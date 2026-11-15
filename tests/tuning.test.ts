import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { FollowCamera } from '../src/game/camera'
import { CONFIG, DEFAULT_CONFIG } from '../src/game/config'
import { Player, type PlayerIntent } from '../src/game/player'
import { tuning } from '../src/game/tuning'

const defaults = Object.fromEntries(tuning.controls.map(control => [control.id, control.default]))
afterEach(() => {
  tuning.apply(defaults)
  tuning.activate('jump')
  tuning.activate('run')
})

describe('Three.js tuning', () => {
  it('validates the whole patch before committing and preserves source defaults', () => {
    const before = tuning.read()
    for (const patch of [
      { 'player.walkSpeed': 8, 'camera.fov': 999 },
      { 'player.walkSpeed': 12 },
      { 'player.walkSpeed': 6.1 },
      { 'player.walkSpeed': '6' },
      { 'camera.fov': Infinity },
      { unknown: 4 },
    ]) {
      expect(() => tuning.apply(patch)).toThrow()
      expect(tuning.read()).toEqual(before)
    }
    tuning.apply({ 'player.walkSpeed': 6, 'player.sprintSpeed': 14 })
    expect(CONFIG.player.walkSpeed).toBe(6)
    expect(CONFIG.player.sprintSpeed).toBe(14)
    expect(DEFAULT_CONFIG.player.walkSpeed).toBe(5.2)
    const applied = tuning.read()
    tuning.apply({ 'player.walkSpeed': 6 })
    expect(tuning.read()).toEqual(applied)
  })

  it('keeps a changed jump pending until the next jump starts', () => {
    tuning.apply({ 'player.jumpSpeed': 14 })
    expect(CONFIG.player.jumpSpeed).toBe(DEFAULT_CONFIG.player.jumpSpeed)
    tuning.activate('jump')
    expect(CONFIG.player.jumpSpeed).toBe(14)
    tuning.apply({ 'player.jumpSpeed': 16 })
    expect(CONFIG.player.jumpSpeed).toBe(14)
    tuning.activate('jump')
    expect(CONFIG.player.jumpSpeed).toBe(16)
  })

  it('changes real movement without replacing the player physics', async () => {
    await initPhysics()
    const physics = new Physics()
    const player = new Player(physics, new THREE.Vector3(0, 5, 0))
    const intent: PlayerIntent = { moveX: 1, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: true }
    try {
      player.grounded = true
      player.step(1 / 60, intent, 0, [])
      const oldSpeed = player.velocity.x
      player.teleport(new THREE.Vector3(0, 5, 0))
      player.grounded = true
      tuning.apply({ 'player.walkSpeed': 10, 'player.sprintSpeed': 14 })
      player.step(1 / 60, intent, 0, [])
      expect(player.velocity.x).toBeGreaterThan(oldSpeed)
    } finally {
      physics.dispose()
    }
  })

  it('updates the actual camera projection without replacing the camera', async () => {
    await initPhysics()
    const physics = new Physics()
    const player = new Player(physics, new THREE.Vector3(0, 5, 0))
    const camera = new FollowCamera(physics, player.collider)
    try {
      const before = camera.camera.projectionMatrix.clone()
      tuning.apply({ 'camera.fov': 90, 'camera.distance': 9 })
      camera.update(new THREE.Vector3(0, 5, 0), { x: 0, y: 0 }, 1, true)
      expect(camera.camera.fov).toBe(90)
      expect(camera.camera.projectionMatrix.equals(before)).toBe(false)
      expect(camera.camera.position.distanceTo(new THREE.Vector3(0, 5 + CONFIG.camera.height * 0.45, 0))).toBeCloseTo(9)
    } finally {
      physics.dispose()
    }
  })
})

describe('ranked eligibility', () => {
  it('ignores cosmetic edits and latches live gameplay edits until a clean new journey', () => {
    tuning.activate('run')
    tuning.apply({ 'camera.fov': 90 })
    expect(tuning.unranked).toBe(false)
    tuning.apply({ 'player.walkSpeed': 6 })
    expect(tuning.unranked).toBe(true)
    tuning.apply(defaults)
    expect(tuning.unranked).toBe(true)
    tuning.activate('run')
    expect(tuning.unranked).toBe(false)
  })

  it('marks a changed jump only when the jump actually starts', () => {
    tuning.activate('run')
    tuning.apply({ 'player.jumpSpeed': 14 })
    expect(tuning.unranked).toBe(false)
    tuning.activate('jump')
    expect(tuning.unranked).toBe(true)
    tuning.apply(defaults)
    tuning.activate('jump')
    expect(tuning.unranked).toBe(true)
    tuning.activate('run')
    expect(tuning.unranked).toBe(false)
  })
})
