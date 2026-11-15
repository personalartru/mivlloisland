import * as THREE from 'three'
import type { LevelId } from './levels'
import type { ItemKind, QuestId } from './content'

/**
 * Where everything stands on a level. Kept free of three.js scene code so the rules, tests and
 * both world builders can share one source of truth for distances and safety checks.
 */
export type LevelLayout = {
  radius: number
  playableRadius: number
  spawn: THREE.Vector3
  npcSpots: Partial<Record<QuestId, THREE.Vector3>>
  itemSpots: Partial<Record<ItemKind, THREE.Vector3[]>>
  /** Glowing lake / pond, kept clear of pickups. */
  water: { center: THREE.Vector3; radius: number }
  /** The level landmark that lights up with every completed task. */
  landmark: THREE.Vector3
  /** A second building (cottage, dome, landing pad) that must stay clear of pickups. */
  building: THREE.Vector3
  /** Deterministic decoration seed. */
  seed: number
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Чудо-остров: the original cozy island, unchanged for existing players. */
export const ISLAND_LAYOUT: LevelLayout = {
  radius: 30,
  playableRadius: 28.2,
  spawn: v(0, 1, 0),
  npcSpots: {
    grandma: v(13.5, 0, 7),
    fairy: v(2, 0, -12),
    mushroom: v(-14, 0, 4),
    cat: v(-2, 0, 16),
  },
  itemSpots: {
    berry: [v(11, 0.7, 8), v(16, 0.7, 11), v(20, 0.7, 8), v(12, 0.7, 2), v(9, 0.7, 5)],
    crystal: [v(0, 0.7, -13), v(9, 0.7, -11), v(10, 0.7, -20), v(-1, 0.7, -19)],
    mushroom: [v(-12, 0.7, 6), v(-17, 0.7, 8), v(-19, 0.7, 0), v(-13, 0.7, -3)],
    star: [v(4, 0.7, 18), v(-6, 0.7, 19), v(1, 0.7, 25)],
  },
  water: { center: v(4, 0, -17), radius: 4.6 },
  landmark: v(0, 0, 22),
  building: v(17, 0, 4),
  seed: 20261115,
}

/**
 * Планета Звёздная: a ringed crystal planet adrift in a nebula. Same friendly flat walking
 * surface, but every landmark, plant, light and inhabitant belongs to deep space.
 */
export const PLANET_LAYOUT: LevelLayout = {
  radius: 30,
  playableRadius: 28.2,
  spawn: v(0, 1, 0),
  npcSpots: {
    lumo: v(12.5, 0, 8.5),
    bip: v(-11.5, 0, 10.5),
    whale: v(0, 0, -12.5),
    keeper: v(-14.5, 0, -6.5),
    comet: v(15.5, 0, -7.5),
    lunatic: v(-3.5, 0, 17.5),
  },
  itemSpots: {
    stardust: [v(10, 0.7, 4.5), v(15.5, 0.7, 7.5), v(18.5, 0.7, 10), v(13.5, 0.7, 12.5), v(9.5, 0.7, 13.5)],
    seed: [v(-8, 0.7, 8), v(-13, 0.7, 7), v(-16, 0.7, 12.5), v(-9.5, 0.7, 14.5)],
    nebula: [v(0, 0.7, -8.5), v(8.5, 0.7, -14), v(2, 0.7, -24)],
    shard: [v(-9, 0.7, -3), v(-13, 0.7, -2.5), v(-18, 0.7, -5), v(-20, 0.7, -10), v(-13, 0.7, -12)],
    spark: [v(10, 0.7, -4), v(16, 0.7, -3), v(20, 0.7, -9), v(11, 0.7, -12)],
    lunar: [v(-6, 0.7, 20), v(3.5, 0.7, 23), v(-8.5, 0.7, 15.5)],
  },
  water: { center: v(5, 0, -18), radius: 4.4 },
  landmark: v(0, 0, 24),
  building: v(-16, 0, 3),
  seed: 20261116,
}

export const LAYOUTS: Record<LevelId, LevelLayout> = {
  island: ISLAND_LAYOUT,
  planet: PLANET_LAYOUT,
}
