import type { DialogVoiceLine } from '../game/game'
import type { LevelId } from '../game/levels'

/**
 * Web Audio mixer with music, effects and character-dialogue buses. Browsers only allow audio
 * after a user gesture, so `unlock()` runs from the first click/key press.
 */
export type Sfx = 'pickup' | 'jump' | 'land' | 'ui' | 'talk' | 'quest' | 'win' | 'clockworkSteam' | 'clockworkPlate' | 'clockworkMotor' | 'clockworkGear' | 'clockworkMechanism'

const baseAudio = (name: string) => import.meta.env.DEV ? `/audio/${name}` : `${import.meta.env.BASE_URL}audio/${name}`
const AUDIO_URLS: Partial<Record<Sfx, string>> = import.meta.env.DEV ? {
  pickup: '/assets/audio/magic/spell.wav', ui: '/assets/audio/ui/ready-click-01.wav', quest: '/assets/audio/magic/chimes.wav', win: '/assets/audio/magic/success.wav',
} : import.meta.env.VITE_GITHUB_PAGES === 'true' ? {
  pickup: `${import.meta.env.BASE_URL}audio/magic/spell.wav`, ui: `${import.meta.env.BASE_URL}audio/ui/ready-click-01.wav`, quest: `${import.meta.env.BASE_URL}audio/magic/chimes.wav`, win: `${import.meta.env.BASE_URL}audio/magic/success.wav`,
} : {
  pickup: '/manus-storage/game/sha256/0eb8fcc00ec39b6c612c36d0b2f996d2b3ceff10d8b84713726160afefd18ea3.wav', ui: '/manus-storage/game/sha256/e62b419e13f681d402640455336ab383d2b2c4a187954b1dd42fb62a79a81827.wav', quest: '/manus-storage/game/sha256/3d3bde1cc09266e52899c61cc70138d5ff71ebc83a39635717a10029fdc536f4.wav', win: '/manus-storage/game/sha256/5399c4f5ff1435df6d9da3990fbebd09ebd6769472bb50b94ae5fc5ef84f7084.wav',
}

const DIALOG_LINES: DialogVoiceLine[] = [
  'grandma-intro', 'grandma-progress', 'grandma-ready', 'grandma-thanks', 'grandma-done', 'fairy-intro', 'fairy-progress', 'fairy-ready', 'fairy-thanks', 'fairy-done', 'mushroom-intro', 'mushroom-progress', 'mushroom-ready', 'mushroom-thanks', 'mushroom-done', 'cat-intro', 'cat-progress', 'cat-ready', 'cat-thanks', 'cat-done', 'lumo-intro', 'whale-intro', 'keeper-intro', 'comet-intro', 'bip-intro', 'lunatic-intro', 'geara-intro', 'piston-intro', 'spring-intro', 'copper-intro', 'tick-intro', 'coralina-intro', 'octo-intro', 'splash-intro', 'pearl-intro', 'fin-intro',
]
const dialogUrl = (line: DialogVoiceLine) => `${import.meta.env.BASE_URL}audio/dialogs/${line}.wav`
const CATALOG: Partial<Record<Sfx, string>> = { ...AUDIO_URLS, clockworkSteam: baseAudio('clockwork-steam.mp3'), clockworkPlate: baseAudio('clockwork-plate.mp3'), clockworkMotor: baseAudio('clockwork-motor.mp3'), clockworkGear: baseAudio('clockwork-gear.mp3'), clockworkMechanism: baseAudio('clockwork-mechanism.mp3') }

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private dialog: GainNode
  private musicTimer = 0
  private musicOn = false
  private musicSource?: AudioBufferSourceNode
  private steamSource?: AudioBufferSourceNode
  private buffers = new Map<string, AudioBuffer>()
  private catalogLoading = false
  private catalogLoaded = false
  private dialogSource?: AudioBufferSourceNode
  private dialogRequest = 0
  constructor() { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain(); this.dialog = this.ctx.createGain(); this.music.connect(this.master); this.sfx.connect(this.master); this.dialog.connect(this.master); this.master.connect(this.ctx.destination) }
  unlock(): void { if (this.ctx.state === 'suspended') void this.ctx.resume(); if (!this.catalogLoading && !this.catalogLoaded) { this.catalogLoading = true; const urls = [...Object.values(CATALOG), ...DIALOG_LINES.map(dialogUrl)]; void Promise.all(urls.map(url => this.load(url).catch(() => null))).then(() => { this.catalogLoaded = true }).finally(() => { this.catalogLoading = false }) } }
  setVolumes(music: number, sfx: number, muted = false): void { const t = this.ctx.currentTime; this.music.gain.setTargetAtTime(muted ? 0 : music * 0.45, t, 0.05); this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.7, t, 0.05); this.dialog.gain.setTargetAtTime(muted ? 0 : sfx * 0.9, t, 0.05) }
  async load(url: string): Promise<AudioBuffer> { const cached = this.buffers.get(url); if (cached) return cached; const data = await (await fetch(url)).arrayBuffer(); const buffer = await this.ctx.decodeAudioData(data); this.buffers.set(url, buffer); return buffer }
  playBuffer(buffer: AudioBuffer, bus: 'music' | 'sfx' | 'dialog' = 'sfx', loop = false): AudioBufferSourceNode { const source = this.ctx.createBufferSource(); source.buffer = buffer; source.loop = loop; source.connect(bus === 'music' ? this.music : bus === 'dialog' ? this.dialog : this.sfx); source.start(); return source }
  playDialog(line: DialogVoiceLine): void { if (this.ctx.state !== 'running') return; this.stopDialog(); const request = this.dialogRequest; const url = dialogUrl(line); const start = (buffer: AudioBuffer) => { if (request !== this.dialogRequest || this.ctx.state !== 'running') return; const source = this.playBuffer(buffer, 'dialog'); this.dialogSource = source; source.addEventListener('ended', () => { if (this.dialogSource === source) this.dialogSource = undefined }) }; const cached = this.buffers.get(url); if (cached) start(cached); else void this.load(url).then(start).catch(() => undefined) }
  stopDialog(): void { this.dialogRequest += 1; if (!this.dialogSource) return; try { this.dialogSource.stop() } catch { /* already ended */ } this.dialogSource = undefined }
  play(name: Sfx): void { if (this.ctx.state !== 'running') return; const url = CATALOG[name]; const buffer = url ? this.buffers.get(url) : undefined; if (buffer) { this.playBuffer(buffer); return } if (url) { void this.load(url).then(loaded => { if (this.ctx.state === 'running') this.playBuffer(loaded) }).catch(() => undefined); return } const t = this.ctx.currentTime; const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) => { const oscillator = this.ctx.createOscillator(); const gain = this.ctx.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(freq, t + delay); oscillator.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur); gain.gain.setValueAtTime(0.0001, t + delay); gain.gain.exponentialRampToValueAtTime(vol, t + delay + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); oscillator.connect(gain).connect(this.sfx); oscillator.start(t + delay); oscillator.stop(t + delay + dur + 0.05) }; switch (name) { case 'pickup': tone(784, 988, .12, 'triangle', .26); tone(1175, 1568, .18, 'sine', .2, .07); break; case 'jump': tone(330, 560, .13, 'triangle', .12); break; case 'land': tone(150, 70, .1, 'sine', .2); break; case 'ui': tone(620, 700, .05, 'triangle', .12); break; case 'talk': tone(520, 660, .09, 'sine', .18); tone(780, 880, .12, 'sine', .14, .08); break; case 'quest': [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq * 1.01, .24, 'triangle', .24, i * .09)); break; case 'win': [392, 523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq * 1.01, .34, 'triangle', .24, i * .12)); break; case 'clockworkSteam': case 'clockworkPlate': case 'clockworkMotor': break } }
  startMusic(level: LevelId = 'island'): void { this.stopMusic(); this.musicOn = true; if (level === 'clockwork') { const musicUrl = baseAudio('clockwork-city.mp3'); const steamUrl = CATALOG.clockworkSteam!; const start = (url: string, loop: boolean, assign: (source: AudioBufferSourceNode) => void) => { const ready = (buffer: AudioBuffer) => { if (!this.musicOn || this.ctx.state !== 'running') return; assign(this.playBuffer(buffer, 'music', loop)) }; const cached = this.buffers.get(url); if (cached) ready(cached); else void this.load(url).then(buffer => ready(buffer)).catch(() => undefined) }; start(musicUrl, true, source => { this.musicSource = source }); const readySteam = (buffer: AudioBuffer) => { if (!this.musicOn || this.ctx.state !== 'running') return; const source = this.playBuffer(buffer, 'sfx', true); this.steamSource = source }; const cachedSteam = this.buffers.get(steamUrl); if (cachedSteam) readySteam(cachedSteam); else void this.load(steamUrl).then(readySteam).catch(() => undefined); return } const melody = [523.3, 659.3, 784, 659.3, 587.3, 698.5, 880, 698.5, 493.9, 587.3, 740, 587.3, 523.3, 659.3, 784, 1046.5]; let step = 0; const schedule = () => { if (!this.musicOn) return; const t = this.ctx.currentTime + .08; const note = melody[step % melody.length]; for (const [freq, vol, delay] of [[note, .055, 0], [note / 2, .03, .01]] as const) { const oscillator = this.ctx.createOscillator(); const gain = this.ctx.createGain(); oscillator.type = 'triangle'; oscillator.frequency.value = freq; gain.gain.setValueAtTime(.0001, t + delay); gain.gain.linearRampToValueAtTime(vol, t + delay + .02); gain.gain.exponentialRampToValueAtTime(.0001, t + delay + 1.1); oscillator.connect(gain).connect(this.music); oscillator.start(t + delay); oscillator.stop(t + delay + 1.15) } if (step % 4 === 0) for (const freq of [261.6, 329.6, 392]) { const oscillator = this.ctx.createOscillator(); const gain = this.ctx.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = freq / 2; gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(.025, t + .6); gain.gain.linearRampToValueAtTime(.0001, t + 2.6); oscillator.connect(gain).connect(this.music); oscillator.start(t); oscillator.stop(t + 2.7) } step += 1; this.musicTimer = window.setTimeout(schedule, 420) }; schedule() }
  stopMusic(): void { this.musicOn = false; clearTimeout(this.musicTimer); for (const source of [this.musicSource, this.steamSource]) { if (!source) continue; try { source.stop() } catch { /* already ended */ } } this.musicSource = undefined; this.steamSource = undefined }
}
