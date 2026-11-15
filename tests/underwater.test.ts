import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bubbleMultiplierAt, createUnderwaterState, updateUnderwaterState } from '../src/game/underwater'
const layout = { resonators: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0)], resonatorRadius: 1, bubbleLanes: [{ center: new THREE.Vector3(0, 0, 5), radius: 2 }] }
describe('underwater mechanics', () => {
  it('activates resonators permanently and lights the beacon after the last one', () => {
    let state = createUnderwaterState(2)
    state = updateUnderwaterState(state, new THREE.Vector3(0, 0, 0), layout)
    expect(state.resonators).toEqual([true, false])
    state = updateUnderwaterState(state, new THREE.Vector3(5, 0, 0), layout)
    expect(state.beaconActive).toBe(true)
  })
  it('boosts movement on bubble lanes only', () => {
    expect(bubbleMultiplierAt(new THREE.Vector3(0, 0, 5), layout)).toBe(1.42)
    expect(bubbleMultiplierAt(new THREE.Vector3(8, 0, 5), layout)).toBe(1)
  })
})
