export type LevelId = 'island' | 'planet'

/** Level order used by menus and the "next level" button. */
export const LEVEL_ORDER: LevelId[] = ['island', 'planet']

export function otherLevel(level: LevelId): LevelId {
  return level === 'island' ? 'planet' : 'island'
}
