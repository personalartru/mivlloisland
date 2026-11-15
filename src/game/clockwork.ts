import * as THREE from 'three'

export type ClockworkLayout = {
  plates: THREE.Vector3[]
  plateRadius: number
  speedPads: Array<{ center: THREE.Vector3; radius: number }>
}

export type ClockworkState = {
  active: boolean[]
  machineActive: boolean
}

export function createClockworkState(count: number): ClockworkState {
  return { active: Array.from({ length: count }, () => false), machineActive: false }
}

export function updateClockworkState(state: ClockworkState, position: THREE.Vector3, layout: ClockworkLayout): ClockworkState {
  const active = state.active.map((on, i) => on || position.distanceTo(layout.plates[i]) <= layout.plateRadius)
  return { active, machineActive: active.every(Boolean) }
}

export function speedMultiplierAt(position: THREE.Vector3, layout: ClockworkLayout): number {
  return layout.speedPads.some(pad => Math.hypot(position.x - pad.center.x, position.z - pad.center.z) <= pad.radius) ? 1.55 : 1
}
