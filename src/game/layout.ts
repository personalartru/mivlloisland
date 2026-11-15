import * as THREE from 'three'
import type { LevelId } from './levels'
import type { ItemKind, QuestId } from './content'
import type { ClockworkLayout } from './clockwork'

export type UnderwaterLayout = {
  resonators: THREE.Vector3[]
  resonatorRadius: number
  bubbleLanes: Array<{ center: THREE.Vector3; radius: number }>
}

export type LevelLayout = {
  radius: number
  playableRadius: number
  spawn: THREE.Vector3
  npcSpots: Partial<Record<QuestId, THREE.Vector3>>
  itemSpots: Partial<Record<ItemKind, THREE.Vector3[]>>
  water: { center: THREE.Vector3; radius: number }
  landmark: THREE.Vector3
  building: THREE.Vector3
  seed: number
  clockwork?: ClockworkLayout
  underwater?: UnderwaterLayout
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export const ISLAND_LAYOUT: LevelLayout = {
  radius: 30, playableRadius: 28.2, spawn: v(0, 1, 0),
  npcSpots: { grandma: v(13.5, 0, 7), fairy: v(2, 0, -12), mushroom: v(-14, 0, 4), cat: v(-2, 0, 16) },
  itemSpots: { berry: [v(11, .7, 8), v(16, .7, 11), v(20, .7, 8), v(12, .7, 2), v(9, .7, 5)], crystal: [v(0, .7, -13), v(9, .7, -11), v(10, .7, -20), v(-1, .7, -19)], mushroom: [v(-12, .7, 6), v(-17, .7, 8), v(-19, .7, 0), v(-13, .7, -3)], star: [v(4, .7, 18), v(-6, .7, 19), v(1, .7, 25)] },
  water: { center: v(4, 0, -17), radius: 4.6 }, landmark: v(0, 0, 22), building: v(17, 0, 4), seed: 20261115,
}
export const PLANET_LAYOUT: LevelLayout = {
  radius: 30, playableRadius: 28.2, spawn: v(0, 1, 0),
  npcSpots: { lumo: v(12.5, 0, 8.5), bip: v(-11.5, 0, 10.5), whale: v(0, 0, -12.5), keeper: v(-14.5, 0, -6.5), comet: v(15.5, 0, -7.5), lunatic: v(-3.5, 0, 17.5) },
  itemSpots: { stardust: [v(10,.7,4.5),v(15.5,.7,7.5),v(18.5,.7,10),v(13.5,.7,12.5),v(9.5,.7,13.5)], seed: [v(-8,.7,8),v(-13,.7,7),v(-16,.7,12.5),v(-9.5,.7,14.5)], nebula: [v(0,.7,-8.5),v(8.5,.7,-14),v(2,.7,-24)], shard: [v(-9,.7,-3),v(-13,.7,-2.5),v(-18,.7,-5),v(-20,.7,-10),v(-13,.7,-12)], spark: [v(10,.7,-4),v(16,.7,-3),v(20,.7,-9),v(11,.7,-12)], lunar: [v(-6,.7,20),v(3.5,.7,23),v(-8.5,.7,15.5)] },
  water: { center: v(5, 0, -18), radius: 4.4 }, landmark: v(0, 0, 24), building: v(-16, 0, 3), seed: 20261116,
}
export const CLOCKWORK_LAYOUT: LevelLayout = {
  radius: 30, playableRadius: 28.2, spawn: v(0, 1, 0),
  npcSpots: { geara: v(13,0,8), piston: v(-12,0,9), spring: v(0,0,-13), copper: v(-14,0,-8), tick: v(14,0,-8) },
  itemSpots: { cog: [v(9,.7,5),v(16,.7,9),v(19,.7,4),v(12,.7,13)], bolt: [v(-8,.7,7),v(-14,.7,6),v(-17,.7,12)], spring: [v(-2,.7,-8),v(6,.7,-14),v(1,.7,-22),v(8,.7,-20)], valve: [v(-8,.7,-5),v(-14,.7,-3),v(-20,.7,-8)], gear: [v(9,.7,-5),v(16,.7,-4),v(20,.7,-10)] },
  water: { center: v(4,0,-18), radius: 3.8 }, landmark: v(0,0,23), building: v(-17,0,4), seed: 20261117,
  clockwork: { plates: [v(0,0,8),v(10,0,0),v(0,0,-10),v(-10,0,0),v(0,0,17)], plateRadius: 1.35, speedPads: [{center:v(5,0,2),radius:2.2},{center:v(-5,0,2),radius:2.2},{center:v(0,0,-4),radius:2.2}] },
}
export const UNDERWATER_LAYOUT: LevelLayout = {
  radius: 30, playableRadius: 28.2, spawn: v(0, 1, 0),
  npcSpots: { coralina: v(13,0,8), octo: v(-12,0,9), splash: v(0,0,-13), pearl: v(-14,0,-8), fin: v(14,0,-8) },
  itemSpots: { pearl: [v(9,.7,5),v(16,.7,9),v(19,.7,4),v(12,.7,13)], coral: [v(-8,.7,7),v(-14,.7,6),v(-17,.7,12)], shell: [v(-2,.7,-8),v(6,.7,-14),v(1,.7,-22),v(8,.7,-20)], kelp: [v(-8,.7,-5),v(-14,.7,-3),v(-20,.7,-8)], bubble: [v(9,.7,-5),v(16,.7,-4),v(20,.7,-10)] },
  water: { center: v(0, 0, 0), radius: 0 }, landmark: v(0,0,23), building: v(-17,0,4), seed: 20261118,
  underwater: { resonators: [v(0,0,8),v(10,0,0),v(0,0,-10),v(-10,0,0),v(0,0,17)], resonatorRadius: 1.35, bubbleLanes: [{center:v(5,0,2),radius:2.2},{center:v(-5,0,2),radius:2.2},{center:v(0,0,-4),radius:2.2}] },
}
export const LAYOUTS: Record<LevelId, LevelLayout> = { island: ISLAND_LAYOUT, planet: PLANET_LAYOUT, clockwork: CLOCKWORK_LAYOUT, underwater: UNDERWATER_LAYOUT }
