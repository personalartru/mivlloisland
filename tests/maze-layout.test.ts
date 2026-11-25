import { describe, expect, it } from 'vitest'
import { CLOCKWORK_LAYOUT, ISLAND_LAYOUT, PLANET_LAYOUT, SUMMIT_LAYOUT, UNDERWATER_LAYOUT } from '../src/game/layout'

describe('quest mazes', () => {
  it.each([
    ['planet', PLANET_LAYOUT, 'stardust', 5],
    ['clockwork', CLOCKWORK_LAYOUT, 'valve', 3],
    ['underwater', UNDERWATER_LAYOUT, 'shell', 4],
    ['summit', SUMMIT_LAYOUT, 'lantern', 4],
  ] as const)('%s maze has a connected route and keeps every quest item in a corridor', (_id, layout, kind, expectedCount) => {
    const maze = layout.maze!
    const rows = maze.grid.length
    const columns = maze.grid[0]!.length
    expect(maze.grid.every(row => row.length === columns)).toBe(true)

    const entrance = maze.grid[0]!.indexOf('.')
    const exit = maze.grid[rows - 1]!.indexOf('.')
    const queue: Array<[number, number]> = [[0, entrance]]
    const reached = new Set(['0:' + entrance])
    for (let index = 0; index < queue.length; index += 1) {
      const [row, column] = queue[index]!
      for (const [nextRow, nextColumn] of [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]) {
        const key = `${nextRow}:${nextColumn}`
        if (maze.grid[nextRow]?.[nextColumn] !== '.' || reached.has(key)) continue
        reached.add(key)
        queue.push([nextRow, nextColumn])
      }
    }
    expect(reached.has(`${rows - 1}:${exit}`)).toBe(true)

    const spots = layout.itemSpots[kind]!
    expect(spots).toHaveLength(expectedCount)
    for (const spot of spots) {
      const column = Math.round((spot.x - maze.center.x) / maze.cellSize + (columns - 1) / 2)
      const row = Math.round((spot.z - maze.center.z) / maze.cellSize + (rows - 1) / 2)
      expect(maze.grid[row]?.[column]).toBe('.')
      expect(reached.has(`${row}:${column}`)).toBe(true)
    }
  })

  it('gives each level after the island a distinct, progressively larger maze', () => {
    expect(ISLAND_LAYOUT.maze).toBeUndefined()
    const mazes = [PLANET_LAYOUT, CLOCKWORK_LAYOUT, UNDERWATER_LAYOUT, SUMMIT_LAYOUT].map(layout => layout.maze!)
    expect(mazes.map(maze => [maze.grid.length, maze.grid[0]!.length])).toEqual([[7, 7], [7, 9], [9, 9], [11, 11]])
    expect(new Set(mazes.map(maze => maze.grid.join('\n'))).size).toBe(mazes.length)

    const openCells = mazes.map(maze => (maze.grid.join('').match(/\./g) ?? []).length)
    expect(openCells.every((count, index) => index === 0 || count > openCells[index - 1]!)).toBe(true)
  })
})
