export type LevelId = 'island' | 'planet'

export const LEVELS: Record<LevelId, { titleKey: string; subtitleKey: string }> = {
  island: { titleKey: 'level.island.title', subtitleKey: 'level.island.subtitle' },
  planet: { titleKey: 'level.planet.title', subtitleKey: 'level.planet.subtitle' },
}
