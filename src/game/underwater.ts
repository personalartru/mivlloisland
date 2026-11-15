import * as THREE from 'three'
import type { UnderwaterLayout } from './layout'

export type UnderwaterState = { resonators: boolean[]; beaconActive: boolean }
export function createUnderwaterState(count: number): UnderwaterState { return { resonators: Array.from({ length: count }, () => false), beaconActive: false } }
export function updateUnderwaterState(state: UnderwaterState, position: THREE.Vector3, layout: UnderwaterLayout): UnderwaterState {
  const resonators = state.resonators.map((on, i) => on || position.distanceTo(layout.resonators[i]) <= layout.resonatorRadius)
  return { resonators, beaconActive: resonators.every(Boolean) }
}
export function bubbleMultiplierAt(position: THREE.Vector3, layout: UnderwaterLayout): number {
  return layout.bubbleLanes.some(lane => Math.hypot(position.x - lane.center.x, position.z - lane.center.z) <= lane.radius) ? 1.42 : 1
}
