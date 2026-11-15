/**
 * All gameplay tuning in one place. Change numbers here before touching game code; tests read
 * the same values so rule changes stay covered.
 */
export const DEFAULT_CONFIG = {
  player: {
    radius: 0.38,
    halfHeight: 0.45,
    walkSpeed: 5.2,
    sprintSpeed: 7.2,
    acceleration: 60,
    airControl: 0.5,
    jumpSpeed: 8.4,
    gravity: -26,
    /** Extra gravity when the jump button is released early, for variable jump height. */
    lowJumpGravity: -46,
    maxFall: -30,
    coyoteTime: 0.14,
    jumpBuffer: 0.16,
    turnSpeed: 12,
  },
  camera: {
    distance: 6.6,
    height: 2.6,
    minPitch: 0.05,
    maxPitch: 0.95,
    follow: 9,
    fov: 60,
  },
  quest: {
    /** Items are picked up when their centre is this close to the player's centre. */
    pickupRadius: 1.15,
    /** Talk distance measured on the ground plane. */
    talkRadius: 3,
    itemPoints: 100,
    questPoints: 500,
    finishBonus: 1000,
  },
} as const

// Gameplay always reads active values here. Source defaults remain immutable for
// Tweak Reset and Save with Manus; Apply never writes source or local storage.
type MutableConfig<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends object ? MutableConfig<T[K]> : T[K] }
export const CONFIG: MutableConfig<typeof DEFAULT_CONFIG> = structuredClone(DEFAULT_CONFIG)
