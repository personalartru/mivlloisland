import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../src/game/content.ts'

const voiceDir = resolve(process.cwd(), 'public/audio/dialogs')
const states = ['intro', 'progress', 'ready', 'thanks', 'done']

describe('dialog voice assets', () => {
  it('includes valid WAV files for all five states of all 25 quest characters', () => {
    const ids = new Set(Object.values(CONTENT).flatMap(level => level.quests.map(quest => quest.id)))
    expect(ids.size).toBe(25)
    for (const id of ids) {
      for (const state of states) {
        const name = `${id}-${state}.wav`
        const file = resolve(voiceDir, name)
        expect(existsSync(file), `${name} exists`).toBe(true)
        const wav = readFileSync(file)
        expect(wav.length, `${name} has data`).toBeGreaterThan(44)
        expect(wav.toString('ascii', 0, 4), `${name} RIFF`).toBe('RIFF')
        expect(wav.toString('ascii', 8, 12), `${name} WAVE`).toBe('WAVE')
      }
    }
  })
})
