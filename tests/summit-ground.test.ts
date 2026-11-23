import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { Player, type PlayerIntent } from '../src/game/player'
import { SUMMIT_LAYOUT } from '../src/game/layout'
import { SummitWorld } from '../src/game/world/final'

let physics: Physics
const neutral: PlayerIntent = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false }

beforeEach(async () => {
  await initPhysics()
  physics = new Physics()
  new SummitWorld(physics, 256, SUMMIT_LAYOUT)
})
afterEach(() => physics.dispose())

describe('Fantastic Mountains ground', () => {
  it('supports the player across the visible platform edge', () => {
    const player = new Player(physics, new THREE.Vector3(20, 2, 0))
    for (let i = 0; i < 90; i += 1) {
      player.step(1 / 60, neutral, 0, [])
      physics.step(1 / 60)
    }
    expect(player.grounded).toBe(true)
    expect(player.position.y).toBeGreaterThan(0.7)
  })
})
