export type LevelId = 'island' | 'planet' | 'clockwork'

export const LEVEL_ORDER: LevelId[] = ['island', 'planet', 'clockwork']

export function nextLevel(level: LevelId): LevelId | null {
  const index = LEVEL_ORDER.indexOf(level)
  return LEVEL_ORDER[index + 1] ?? null
}

export function previousLevel(level: LevelId): LevelId | null {
  const index = LEVEL_ORDER.indexOf(level)
  return LEVEL_ORDER[index - 1] ?? null
}

/** Kept for existing callers: move to the next available level, wrapping to island. */
export function otherLevel(level: LevelId): LevelId {
  return nextLevel(level) ?? LEVEL_ORDER[0]
}
