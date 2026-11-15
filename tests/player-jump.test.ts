import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { CONFIG } from '../src/game/config'
import { Player, type PlayerEvent, type PlayerIntent } from '../src/game/player'

let physics: Physics
let player: Player
let events: PlayerEvent[]
const neutral: PlayerIntent = { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, jumpHeld: false }
function step(intent: Partial<PlayerIntent> = {}): void { player.step(1 / 60, { ...neutral, ...intent }, 0, events) }
const jumps = () => events.filter(e => e.type === 'jump')

beforeEach(async () => {
  await initPhysics()
  physics = new Physics()
  player = new Player(physics, new THREE.Vector3(0, 5, 0))
  events = []
})
afterEach(() => physics.dispose())

describe('jump', () => {
  it('jumps immediately on the ground', () => {
    player.grounded = true
    step({ jumpPressed: true, jumpHeld: true })
    expect(events).toEqual([{ type: 'jump' }])
    expect(player.velocity.y).toBeCloseTo(CONFIG.player.jumpSpeed + CONFIG.player.gravity / 60)
  })

  it('accepts a jump in the final valid coyote step', () => {
    player.grounded = true; step()
    for (let i = 0; i < 6; i++) step()
    step({ jumpPressed: true, jumpHeld: true })
    expect(jumps()).toHaveLength(1)
  })

  it('does not add an air jump once the coyote window has expired', () => {
    player.grounded = true; step()
    for (let i = 0; i < 8; i++) step()
    step({ jumpPressed: true, jumpHeld: true })
    expect(jumps()).toHaveLength(0)
  })

  it('keeps a pre-landing jump buffered', () => {
    step({ jumpPressed: true, jumpHeld: true })
    expect(jumps()).toHaveLength(0)
    step(); step()
    player.grounded = true; step()
    expect(jumps()).toHaveLength(1)
  })

  it('does not jump on a much later landing after buffered input expires', () => {
    step({ jumpPressed: true, jumpHeld: true })
    for (let i = 0; i < 30; i++) step()
    player.grounded = true; step()
    expect(jumps()).toHaveLength(0)
  })

  it('does not repeat jump just because the button remains held at landing', () => {
    player.grounded = true; step({ jumpPressed: true, jumpHeld: true })
    for (let i = 0; i < 30; i++) step({ jumpHeld: true })
    player.grounded = true; step({ jumpHeld: true })
    expect(jumps()).toHaveLength(1)
  })

  it('uses the lighter low-jump gravity for a short tap', () => {
    player.grounded = true; step({ jumpPressed: true, jumpHeld: false })
    expect(player.velocity.y).toBeCloseTo(CONFIG.player.jumpSpeed + CONFIG.player.lowJumpGravity / 60)
  })
})
