import './styles/main.css'
import { createLeaderboardClient, type LeaderboardClient, type RunTicket } from '../leaderboard.js'
import { Audio } from './engine/audio'
import { I18n } from './engine/i18n'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type SaveData } from './engine/save'
import type { Game, GameHooks } from './game/game'
import type { ModelPack } from './game/models'
import { MODEL_URLS } from './game/modelUrls'
import type { LevelId } from './game/levels'
import type { JourneyState } from './game/rules'
import { TouchControls } from './ui/touch'
import { Ui, type OnlineEntry } from './ui/ui'

const BOARD_ID = 'friendship-v1'
const RULES_VERSION = 'v1'
/** Local dev has no API; GitHub Pages is explicitly local-only. Checkpoint Preview exercises the online board. */
const PAGES_LOCAL_ONLY = import.meta.env.VITE_GITHUB_PAGES === 'true'
const ONLINE_ENABLED = !PAGES_LOCAL_ONLY && !import.meta.env.DEV && !['localhost', '127.0.0.1', ''].includes(location.hostname) && location.protocol.startsWith('http')

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()
  const i18n = new I18n('ru')
  const input = new Input(canvas)
  const audio = new Audio()
  let game: Game | undefined
  let g: Game | undefined
  let lockLostAt = 0

  // ─── online leaderboard state ─────────────────────────────────────────
  let client: LeaderboardClient | undefined
  let ticket: RunTicket | null = null
  let beginError = ''
  let pendingResult: { score: number; durationMs: number } | null = null
  const getClient = () => (client ??= createLeaderboardClient({ identity: 'guest', boardId: BOARD_ID, rulesVersion: RULES_VERSION }))

  const beginOnlineRun = async (): Promise<void> => {
    if (!ONLINE_ENABLED) {
      ui.setOnlineStatus('unranked')
      return
    }
    if (game?.journey.unranked) {
      ui.setOnlineStatus('unranked')
      return
    }
    try {
      const guest = await getClient().ensureGuest(save.data.playerName)
      if (!guest.ok) throw new Error(guest.error)
      const run = await getClient().beginRun()
      if (!run.ok) throw new Error(run.error)
      ticket = run.value
      beginError = ''
      if (pendingResult) void submitOnline(run.value, pendingResult)
    } catch (error) {
      beginError = messageOf(error)
      if (game?.mode === 'ended') ui.setOnlineStatus('error', beginError)
    }
  }

  const submitOnline = async (run: RunTicket, result: { score: number; durationMs: number }): Promise<void> => {
    try {
      const response = await getClient().submitRun(run, result.score, result.durationMs)
      if (!response.ok) {
        ui.setOnlineStatus('error', friendlyError(response.error))
        return
      }
      ticket = null
      pendingResult = null
      const rank = response.value.leaderboard.ok ? response.value.leaderboard.value.myRank?.rank : undefined
      ui.setOnlineStatus('saved', '', rank)
    } catch (error) {
      ui.setOnlineStatus('error', friendlyError(messageOf(error)))
    }
  }

  const retrySubmit = async (): Promise<void> => {
    if (!pendingResult) return
    if (ticket) await submitOnline(ticket, pendingResult)
    else await beginOnlineRun()
  }

  const loadBoard = async (): Promise<void> => {
    if (!ONLINE_ENABLED) {
      ui.setOnlineBoard(null, 'offline')
      return
    }
    ui.setOnlineBoard(null, 'loading')
    try {
      const response = await getClient().list(20)
      if (!response.ok) {
        ui.setOnlineBoard(null, 'error', friendlyError(response.error))
        return
      }
      const entries: OnlineEntry[] = response.value.entries.map(entry => ({
        rank: entry.rank, name: entry.displayName, score: entry.score, seconds: null,
      }))
      ui.setOnlineBoard(entries, 'ready')
    } catch (error) {
      ui.setOnlineBoard(null, 'error', friendlyError(messageOf(error)))
    }
  }

  // ─── settings, screens and run flow ───────────────────────────────────
  const applySettings = (data: SaveData) => {
    input.sensitivity = data.sensitivity
    input.invertY = data.invertY
    audio.setVolumes(data.musicVolume, data.sfxVolume, data.muted)
    if (game) game.reducedMotion = data.reducedMotion
  }

  const startRun = (level: LevelId, tutorial: boolean) => {
    if (!game || !models) return
    if (level === 'planet' && !save.data.planetUnlocked) return
    if (level === 'clockwork' && !save.data.clockworkUnlocked) return
    if (game.level !== level) {
      game = new Game(renderer, input, audio, i18n, hooks, models, level)
      game.reducedMotion = save.data.reducedMotion
      g = game
    }
    ui.setLevel(level)
    audio.stopDialog()
    audio.unlock()
    audio.startMusic(level)
    ticket = null
    pendingResult = null
    beginError = ''
    game.start(tutorial)
    ui.show('hud')
    loop.resetAccumulator()
    input.lockPointer()
    void beginOnlineRun()
  }

  const pause = () => {
    if (game?.mode !== 'playing' && game?.mode !== 'talking') return
    audio.stopDialog()
    game.pause()
    ui.show('pause')
    input.unlockPointer()
  }

  const resume = () => {
    if (game?.mode !== 'paused') return
    game.resume()
    ui.show('hud')
    loop.resetAccumulator()
    input.lockPointer()
  }

  const onEnd = (journey: JourneyState) => {
    input.unlockPointer()
    pendingResult = { score: journey.score, durationMs: Math.max(1000, Math.round(journey.elapsed * 1000)) }
    ui.showResults(journey)
    if (!ONLINE_ENABLED || journey.unranked) {
      ui.setOnlineStatus('unranked')
      return
    }
    if (ticket) void submitOnline(ticket, pendingResult)
    else if (beginError) ui.setOnlineStatus('error', beginError)
    else ui.setOnlineStatus('pending')
  }

  const hooks: GameHooks = {
    popup: (text, at, kind) => ui.popup(text, at, kind),
    hint: hint => ui.hint(hint),
    dialog: data => ui.showDialog(data),
    dialogClose: () => ui.hideDialog(),
    questDone: id => ui.questDone(id),
    tutorialDone: () => save.update({ tutorialDone: true }),
    end: (journey, level) => {
      if (level === 'island' && !save.data.planetUnlocked) save.update({ planetUnlocked: true })
      if (level === 'planet' && !save.data.clockworkUnlocked) save.update({ clockworkUnlocked: true })
      onEnd(journey)
    },
  }

  const ui = new Ui(i18n, save, audio, input, {
    play: level => startRun(level, !save.data.tutorialDone && level === 'island'),
    pause,
    restart: () => startRun(game?.level ?? 'island', false),
    resume,
    quit: () => {
      audio.stopDialog()
      game?.toTitle()
      ui.show('title')
      input.unlockPointer()
    },
    settings: patch => {
      const qualityChanged = patch.quality !== undefined && patch.quality !== save.data.quality
      save.update(patch)
      applySettings(save.data)
      if (qualityChanged) game?.setQuality(save.data.quality)
    },
    dialog: action => game?.dialogAction(action),
    loadLeaderboard: () => void loadBoard(),
    retrySubmit: () => void retrySubmit(),
  })
  ui.show('boot')
  applySettings(save.data)

  // ─── boot: engine chunks and the complete first playable segment ───────
  let loaded = 0
  const track = <T>(promise: Promise<T>): Promise<T> => promise.then(value => {
    loaded += 1
    ui.setBootProgress(0.05 + (loaded / 5) * 0.2)
    return value
  })
  ui.setBootProgress(0.05)
  const [{ Game }, { Renderer, suggestQuality }, physics, { Assets }, fonts] = await Promise.all([
    track(import('./game/game')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(import('./engine/assets')),
    track(document.fonts.ready),
  ])
  void fonts
  await physics.initPhysics()
  if (firstRun) {
    save.update({ quality: suggestQuality() })
    ui.refreshSettings()
  }

  let models: ModelPack
  try {
    models = await loadModels(new Assets(), progress => ui.setBootProgress(0.25 + progress * 0.7))
  } catch (error) {
    ui.bootError(i18n.t('error.boot'))
    return
  }

  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, input, audio, i18n, hooks, models, 'island')
  g = game
  game.reducedMotion = save.data.reducedMotion
  if (import.meta.env.DEV) {
    const [{ registerGameTuning }, { tuning }] = await Promise.all([
      import('../scripts/manus-tuning/adapter.js'), import('./game/tuning'),
    ])
    await registerGameTuning(tuning)
  }
  const loop = new GameLoop({
    beforeFrame: frameSeconds => input.update(frameSeconds),
    step: dt => g?.step(dt),
    render: (alpha, frameSeconds) => {
      if (!g) return
      if (input.consume('pause') && performance.now() - lockLostAt > 300) {
        if (g.mode === 'playing') pause()
        else if (g.mode === 'paused' && ui.screen === 'pause') resume()
      }
      ui.frame(frameSeconds)
      loop.paused = g.mode === 'paused'
      g.render(alpha, frameSeconds)
      if (g.mode === 'playing' || g.mode === 'talking' || g.mode === 'ended') {
        ui.updateHud(g.journey, g.compass(), g.interactTarget)
      }
    },
  })
  loop.start()

  document.addEventListener('pointerlockchange', () => {
    if (!g) return
    if (!document.pointerLockElement && g.mode === 'playing' && input.method === 'keyboard') {
      lockLostAt = performance.now()
      pause()
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
  })
  window.addEventListener('game:pause', pause)
  canvas.addEventListener('click', () => {
    if (g?.mode === 'playing') input.lockPointer()
  })
  new TouchControls(document.getElementById('ui')!, input, () => g?.mode === 'playing')

  ui.setBootProgress(1)
  window.setTimeout(() => ui.show('title'), 250)
  ;(window as unknown as { __game: unknown }).__game = { get game() { return g }, ui, input, save }
}

async function loadModels(assets: import('./engine/assets').Assets, onProgress: (progress: number) => void): Promise<ModelPack> {
  const urls = [
    MODEL_URLS.player,
    MODEL_URLS.npcs.grandma, MODEL_URLS.npcs.fairy, MODEL_URLS.npcs.mushroom, MODEL_URLS.npcs.cat,
    MODEL_URLS.items.berry, MODEL_URLS.items.crystal, MODEL_URLS.items.mushroom, MODEL_URLS.items.star,
    MODEL_URLS.props.tree, MODEL_URLS.props.cottage,
  ]
  let done = 0
  const loaded = await Promise.all(urls.map(async url => {
    const gltf = await assets.gltf(url)
    done += 1
    onProgress(done / urls.length)
    return gltf
  }))
  return {
    player: loaded[0],
    npcs: { grandma: loaded[1], fairy: loaded[2], mushroom: loaded[3], cat: loaded[4] },
    items: { berry: loaded[5], crystal: loaded[6], mushroom: loaded[7], star: loaded[8] },
    props: { tree: loaded[9], cottage: loaded[10] },
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function friendlyError(message: string): string {
  return /json|fetch|network|load failed|failed to fetch/i.test(message)
    ? 'Доска почёта сейчас недоступна, но игра работает.'
    : message
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

boot().catch(error => {
  console.error(error)
  const el = document.getElementById('ui')
  if (el) el.innerHTML = `<div class="fatal">Не получилось запустить игру. Попробуйте обновить страницу.</div>`
})
