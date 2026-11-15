import type * as THREE from 'three'

/**
 * How one friendly character is drawn. Island residents come from generated GLB files, cosmic
 * residents are built from geometry, but the scene treats both the same way.
 */
export type NpcVisual = {
  /** World height the model is normalised to (bubble sits above it). */
  height: number
  build: () => THREE.Group
  /** Per-character idle animation, called every rendered frame. */
  tick?: (visual: THREE.Group, time: number) => void
  /** Vertical bob amplitude; cosmic characters float more than islanders. */
  bob?: number
  /** Base lift above the ground. */
  hover?: number
  /** Collider radius so children cannot walk through a big friend. */
  collider?: number
}
