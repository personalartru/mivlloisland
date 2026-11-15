import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createClockworkState, speedMultiplierAt, updateClockworkState } from '../src/game/clockwork'

const layout = { plates: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0)], plateRadius: 1, speedPads: [{ center: new THREE.Vector3(0, 0, 5), radius: 2 }] }

describe('clockwork mechanics', () => {
  it('activates plates permanently and starts the machine after all five/synthetic plates', () => {
    let state = createClockworkState(2)
    state = updateClockworkState(state, new THREE.Vector3(0, 0, 0), layout)
    expect(state.active).toEqual([true, false])
    state = updateClockworkState(state, new THREE.Vector3(5, 0, 0), layout)
    expect(state.active).toEqual([true, true])
    expect(state.machineActive).toBe(true)
  })
  it('boosts only while standing on a speed pad', () => {
    expect(speedMultiplierAt(new THREE.Vector3(0, 0, 5), layout)).toBe(1.55)
    expect(speedMultiplierAt(new THREE.Vector3(8, 0, 5), layout)).toBe(1)
  })
})
