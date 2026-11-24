import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import { insertScore, type Quality, type SaveData, type SaveStore } from '../engine/save'
import type { CompassTarget, DialogAction, DialogData, DialogVoiceLine, Hint } from '../game/game'
import { CONTENT, itemDef, questOf, type ItemKind, type LevelContent, type QuestId } from '../game/content'
import { formatDuration, starsOf, type JourneyState } from '../game/rules'
import type { NpcInfo } from '../game/npcs'
import { otherLevel, type LevelId } from '../game/levels'

export type Screen = 'boot' | 'title' | 'hud' | 'pause' | 'settings' | 'leaderboard' | 'results' | 'dialog'

export type OnlineState = 'pending' | 'saved' | 'error' | 'unranked'

export type OnlineEntry = { rank: number; name: string; score: number; seconds: number | null }

export type UiActions = {
  play(level: LevelId): void
  pause(): void
  resume(): void
  restart(): void
  quit(): void
  settings(patch: Partial<SaveData>): void
  dialog(action: DialogAction): void
  loadLeaderboard(): void
  retrySubmit(): void
}

const ICON: Record<ItemKind, string> = {
  berry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-4.6 0-7.6-3.3-7.6-7.1 0-3.3 2.2-6.2 5.2-7.2l2.4-.8 2.4.8c3 .9 5.2 3.9 5.2 7.2C19.6 17.7 16.6 21 12 21Z" fill="#ff5a6e"/><path d="M12 6.5c-.8-1.9-2.4-3-4.5-3.2.2 2.2 1.4 3.7 3.3 4.4ZM12 6.5c.8-1.9 2.4-3 4.5-3.2-.2 2.2-1.4 3.7-3.3 4.4Z" fill="#5fc45f"/><g fill="#fff1c9"><circle cx="9" cy="13" r=".8"/><circle cx="14" cy="12" r=".8"/><circle cx="12" cy="17" r=".8"/></g></svg>',
  crystal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8 19 9l-3.3 12.2H8.3L5 9Z" fill="#69d7ff"/><path d="M12 1.8 19 9l-7 2.4Z" fill="#c6f4ff"/><path d="m5 9 7 2.4L8.3 21.2Z" fill="#3eb7e8"/></svg>',
  mushroom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 13h5.2l-.7 8H10Z" fill="#fff0d4"/><path d="M12 3C6.7 3 2.8 7.3 2.8 12c0 1.2.8 2 2 2h14.4c1.2 0 2-.8 2-2C21.2 7.3 17.3 3 12 3Z" fill="#ff7a55"/><g fill="#fff6e5"><circle cx="8" cy="8.5" r="1.4"/><circle cx="15.8" cy="7.8" r="1.1"/><circle cx="16.8" cy="11" r=".9"/></g></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.6 3.1 6.5 7.1.9-5.2 4.9 1.4 7L12 17.5 5.6 20.9l1.4-7L1.8 9l7.1-.9Z" fill="#ffd24a" stroke="#fff6cf" stroke-width="1.1"/></svg>',
  stardust: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z" fill="#ffe07a" stroke="#fff6cf" stroke-width="1.2"/><circle cx="4.4" cy="5" r="1.2" fill="#fff6cf"/><circle cx="19.6" cy="18.6" r="1" fill="#fff6cf"/></svg>',
  seed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c4 4.2 6 7.6 6 10.6a6 6 0 0 1-12 0c0-3 2-6.4 6-10.6Z" fill="#7ef0d0"/><path d="M9.6 9.6c.6 2 .6 4.2 0 6.2" stroke="#e6fff8" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M14.4 6.4c2.2-.4 4 .4 5 2-2 .6-4 .2-5-2Z" fill="#8ff7b0"/></svg>',
  nebula: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ff9ae6" opacity=".85"/><circle cx="12" cy="12" r="9" fill="none" stroke="#ffd0f6" stroke-width="1.6"/><path d="M12 12c2-3 5-3 6.5-1.2-1.8 1.4-4 1.6-6.5 1.2Z" fill="#b79cff"/><circle cx="8.6" cy="8.6" r="1.6" fill="#fff6ff"/></svg>',
  shard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 1.5 18 8.5 15 22.5 6 16.5Z" fill="#9ad8ff"/><path d="M9.5 1.5 18 8.5 12 12Z" fill="#e6f8ff"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4c-2.4 6-6.4 10-12.4 12.6C5 17.8 3 20 2 22c4.6-1.4 8-2 11-4.4C17.6 14 19.6 9 20 4Z" fill="#ffb35c"/><circle cx="17" cy="7" r="4.2" fill="#ffe9a8"/></svg>',
  lunar: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#e8e6ff"><ellipse cx="12" cy="6.4" rx="2.6" ry="4"/><ellipse cx="17.6" cy="11" rx="4" ry="2.6"/><ellipse cx="14.6" cy="17.4" rx="2.8" ry="3.6" transform="rotate(-40 14.6 17.4)"/><ellipse cx="9.4" cy="17.4" rx="2.8" ry="3.6" transform="rotate(40 9.4 17.4)"/><ellipse cx="6.4" cy="11" rx="4" ry="2.6"/></g><circle cx="12" cy="12" r="2.6" fill="#fff6d0"/></svg>',
  cog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6l.6 3a7.5 7.5 0 0 1 2 1.2l2.8-1.1 3 5.2-2.2 2a7.5 7.5 0 0 1 0 2.4l2.2 2-3 5.2-2.8-1.1a7.5 7.5 0 0 1-2 1.2l-.6 3H9l-.6-3a7.5 7.5 0 0 1-2-1.2l-2.8 1.1-3-5.2 2.2-2a7.5 7.5 0 0 1 0-2.4l-2.2-2 3-5.2 2.8 1.1a7.5 7.5 0 0 1 2-1.2Z" fill="#f2b35c"/><circle cx="12" cy="12" r="3.2" fill="#fff4c9"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 1-9 13h7l-1 9 9-13h-7Z" fill="#7fe0d2"/></svg>',
  spring: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3c10 0 10 5 0 5s-1 5 8 5 9 5 2 8" fill="none" stroke="#f08a68" stroke-width="3" stroke-linecap="round"/></svg>',
  valve: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="#a7a9bd" stroke-width="3"/><path d="M12 2v20M2 12h20" stroke="#e5e6ff" stroke-width="2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="#ffd35c" stroke-width="4"/><circle cx="12" cy="12" r="2" fill="#fff0a8"/></svg>',
  pearl: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7" fill="#fff0c4" stroke="#fffdf0" stroke-width="2"/><path d="M8 7c1-3 7-3 8 0" fill="none" stroke="#d9b8e9" stroke-width="2"/></svg>',
  coral: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V10M12 14 7 9M12 16l6-6M8 11V6M18 11V5" stroke="#ff887b" stroke-width="3" stroke-linecap="round"/></svg>',
  shell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c0-7 4-11 9-11s9 4 9 11Z" fill="#d9b3ff" stroke="#f0ddff" stroke-width="1.5"/><path d="M12 7v10M7 9l3 8M17 9l-3 8" stroke="#fff" stroke-width="1" opacity=".8"/></svg>',
  kelp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 22c4-5-2-8 2-13 2-3-1-5 0-7M15 22c-3-5 3-8-1-13-2-3 1-5 0-7" fill="none" stroke="#67d6a0" stroke-width="3" stroke-linecap="round"/></svg>',
  rune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 8l-3 12H7L4 8Z" fill="#d59cff" stroke="#f1d8ff"/><path d="M8 12h8M10 8h4" stroke="#fff" stroke-width="1.5"/></svg>',
  feather: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3C9 4 5 9 5 16c0 2 1 4 1 4s2-1 4-1c7 0 9-6 9-16Z" fill="#8eeaff"/><path d="M5 21 16 8" stroke="#fff" stroke-width="1.5"/></svg>',
  ore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 6-3 12H7L4 8Z" fill="#ff9b73"/></svg>',
  lantern: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="#ffd65c"/><path d="M8 4h8M8 20h8" stroke="#fff0a3" stroke-width="2"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 4 4 5-7 5 7 4-4-2 13H5Z" fill="#ffe77a" stroke="#fff8c9"/></svg>',
  bubble: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="13" r="6" fill="#81e7ff" fill-opacity=".55" stroke="#d5f9ff" stroke-width="1.5"/><circle cx="17" cy="6" r="3" fill="#81e7ff" fill-opacity=".55" stroke="#d5f9ff" stroke-width="1.2"/></svg>',
}

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12.8 5.2 5.2L20 6.8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.6 3.1 6.5 7.1.9-5.2 4.9 1.4 7L12 17.5 5.6 20.9l1.4-7L1.8 9l7.1-.9Z" fill="#ffd24a" stroke="#fff6cf" stroke-width="1.1"/></svg>'

const GLYPH = {
  keyboard: { move: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', look: '<span class="mouse-icon"></span>', jump: '<kbd class="wide">Пробел</kbd>', talk: '<kbd>E</kbd>', collect: '<span class="hint-spark">✦</span>' },
  gamepad: { move: '<kbd class="round">L</kbd>', look: '<kbd class="round">R</kbd>', jump: '<kbd class="round a">A</kbd>', talk: '<kbd class="round y">Y</kbd>', collect: '<span class="hint-spark">✦</span>' },
  touch: { move: '', look: '', jump: '', talk: '', collect: '<span class="hint-spark">✦</span>' },
}

/** DOM UI: title, HUD, dialogs, pause, settings, results and the honour board. */
export class Ui {
  screen: Screen = 'boot'
  lastMethod = ''
  navRepeat = 0
  level: LevelId = 'island'
  private content: LevelContent = CONTENT.island
  private readonly root: HTMLElement
  private readonly promptEl: HTMLElement
  private readonly hintEl: HTMLElement
  private readonly stack: Screen[] = []
  private readonly hudCache = new Map<string, string>()
  private hintKey: Hint | null = null
  private lastJourney?: JourneyState
  private savedRank = -1
  private bannerTimer = 0
  private onlineMessage = ''
  private onlineEntries: OnlineEntry[] | null = null
  private onlineLoading = false
  private dialogVoice?: DialogVoiceLine

  constructor(
    private readonly i18n: I18n,
    private readonly save: SaveStore,
    private readonly audio: Audio,
    private readonly input: Input,
    private readonly actions: UiActions,
  ) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = template()
    this.promptEl = this.root.querySelector('.prompt')!
    this.hintEl = this.root.querySelector('.hint')!
    this.root.addEventListener('click', event => this.onClick(event))
    this.root.addEventListener('input', event => this.onInput(event))
    this.root.addEventListener('change', event => this.onInput(event))
    this.root.addEventListener('focusin', event => {
      if ((event.target as HTMLElement).matches('.btn, .seg button, .toggle, .level-card')) this.audio.play('ui')
    })
    window.addEventListener('keydown', event => this.onKey(event))
    i18n.onChange(() => {
      this.translate()
      this.refreshSettings()
      this.renderInventory()
      if (this.lastJourney) this.showResults(this.lastJourney, false)
    })
    this.lastMethod = input.method
    this.translate()
    this.refreshSettings()
    this.setLevel('island')
  }

  // ─── screens ─────────────────────────────────────────────────────────────

  show(screen: Screen): void {
    this.stack.length = 0
    this.setScreen(screen)
  }

  push(screen: Screen): void {
    this.stack.push(this.screen)
    this.setScreen(screen)
  }

  back(): void {
    const previous = this.stack.pop()
    if (previous) {
      this.setScreen(previous)
      return
    }
    if (this.screen === 'dialog') this.actions.dialog('close')
    else if (this.screen === 'pause') this.actions.resume()
    else if (this.screen === 'settings' || this.screen === 'leaderboard') this.setScreen('title')
  }

  private setScreen(screen: Screen): void {
    this.screen = screen
    const fromPause = this.stack.includes('pause')
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-screen]')) {
      const name = el.dataset.screen as Screen
      const active = name === screen || (name === 'hud' && (screen === 'pause' || screen === 'dialog' || (screen === 'settings' && fromPause)))
      el.classList.toggle('is-active', active)
      el.setAttribute('aria-hidden', String(!active))
    }
    this.root.dataset.activeScreen = screen
    if (screen === 'title') {
      this.renderBest()
      this.refreshLevelButtons()
    }
    if (screen === 'leaderboard') {
      this.renderLocalBoard()
      this.renderOnlineBoard()
      this.actions.loadLeaderboard()
    }
    if (screen === 'hud') this.updateHint()
    if (screen !== 'hud') {
      requestAnimationFrame(() => {
        const first = this.navItems()[0]
        if (first && this.input.method !== 'touch') first.focus({ preventScroll: true })
        else (document.activeElement as HTMLElement | null)?.blur?.()
      })
    }
  }

  /** Switch HUD copy, icons and theme to the level being played. */
  setLevel(level: LevelId): void {
    this.level = level
    this.content = CONTENT[level]
    this.root.dataset.level = level
    this.hudCache.clear()
    this.renderInventory()
  }

  setBootProgress(progress: number): void {
    const bar = this.q<HTMLElement>('.boot-bar i')
    bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, progress))})`
  }

  bootError(message: string): void {
    const retry = this.q<HTMLButtonElement>('.boot-retry')
    retry.hidden = false
    const error = this.q<HTMLElement>('.boot-error')
    error.hidden = false
    error.textContent = message
    this.q('.boot-bar').classList.add('is-error')
    this.q<HTMLElement>('.boot-status').textContent = this.i18n.t('boot.error')
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────

  updateHud(journey: JourneyState, compass: CompassTarget | null, target: NpcInfo | null): void {
    this.lastJourney = journey
    this.renderTasks(journey)
    this.renderInventory()
    this.renderCompass(compass)
    this.renderPrompt(target)
    if (this.lastMethod !== this.input.method) {
      this.lastMethod = this.input.method
      this.updateHint()
      this.renderPrompt(target)
    }
  }

  hint(hint: Hint | null): void {
    this.hintKey = hint
    this.updateHint()
  }

  private hintKeyFor(hint: Hint): string {
    return hint === 'collect' ? this.content.collectHintKey : `hint.${hint}.${this.input.method}`
  }

  private updateHint(): void {
    const el = this.q<HTMLElement>('.hint')
    if (!this.hintKey) {
      el.hidden = true
      return
    }
    const method = this.input.method
    const glyph = GLYPH[method][this.hintKey]
    el.hidden = false
    this.q('.hint-glyph').innerHTML = glyph
    this.q('.hint-text').textContent = this.i18n.t(this.hintKeyFor(this.hintKey))
  }

  private renderTasks(journey: JourneyState): void {
    const visible = this.content.quests.filter(q => journey.quests[q.id] !== 'available')
    const done = this.content.quests.filter(q => journey.quests[q.id] === 'done').length
    const key = visible.map(q => `${q.id}:${journey.quests[q.id]}:${journey.inventory[q.item]}`).join('|') + `:${visible.length}:${done}`
    if (this.hudCache.get('tasks') === key) return
    this.hudCache.set('tasks', key)
    this.q<HTMLElement>('.tasks-count').textContent = `${done}/${this.content.quests.length}`
    const list = this.q<HTMLElement>('.task-list')
    if (visible.length === 0) {
      list.innerHTML = `<p class="tasks-empty">${escapeHtml(this.i18n.t(this.content.noTasksKey))}</p>`
      return
    }
    list.innerHTML = visible.map(quest => {
      const status = journey.quests[quest.id]
      const have = Math.min(journey.inventory[quest.item], quest.need)
      return `<div class="task ${status === 'done' ? 'is-done' : ''}" style="--accent:${quest.accent}">
        <span class="task-avatar">${escapeHtml(this.i18n.t(quest.nameKey).slice(0, 1))}</span>
        <span class="task-copy"><b>${escapeHtml(this.i18n.t(quest.titleKey))}</b>
          <small>${status === 'done' ? this.i18n.t('hud.taskDone') : `${escapeHtml(this.i18n.t(itemDef(this.content, quest.item).nameKey))} · ${have}/${quest.need}`}</small></span>
        <span class="task-icon">${status === 'done' ? CHECK : ICON[quest.item]}</span>
      </div>`
    }).join('')
  }

  private renderInventory(): void {
    const list = this.q<HTMLElement>('.inventory')
    const kinds = this.content.itemKinds
    const wanted = kinds.join(',')
    if (list.dataset.kinds !== wanted) {
      list.dataset.kinds = wanted
      list.innerHTML = kinds.map(kind => `<div class="inv-item is-empty" data-inv="${kind}" title="${escapeHtml(this.i18n.t(itemDef(this.content, kind).nameKey))}"><span class="inv-icon">${ICON[kind]}</span><b>0</b></div>`).join('')
      this.hudCache.delete('inventory')
    }
    if (!this.lastJourney) return
    const key = kinds.map(kind => this.lastJourney!.inventory[kind]).join(',')
    if (this.hudCache.get('inventory') === key) return
    this.hudCache.set('inventory', key)
    for (const kind of kinds) {
      const el = this.q<HTMLElement>(`[data-inv="${kind}"] b`)
      if (!el) continue
      el.textContent = String(this.lastJourney.inventory[kind])
      el.parentElement!.classList.toggle('is-empty', this.lastJourney.inventory[kind] === 0)
    }
  }

  private renderCompass(compass: CompassTarget | null): void {
    const el = this.q<HTMLElement>('.compass')
    if (!compass) {
      el.hidden = true
      return
    }
    el.hidden = false
    const label = compass.kind === 'item'
      ? this.i18n.t('hud.compassItem', { item: this.i18n.t(itemDef(this.content, compass.item ?? this.content.itemKinds[0]).nameKey), m: Math.round(compass.distance) })
      : this.i18n.t('hud.compassNpc', { name: this.i18n.t(questOf(this.content, compass.npc!)?.nameKey ?? ''), m: Math.round(compass.distance) })
    const arrow = this.q<HTMLElement>('.compass-arrow')
    arrow.style.transform = `rotate(${(-compass.angle * 180) / Math.PI}deg)`
    const text = this.q<HTMLElement>('.compass-label')
    if (text.textContent !== label) text.textContent = label
  }

  private renderPrompt(target: NpcInfo | null): void {
    const prompt = this.q<HTMLElement>('.prompt')
    const talk = this.q<HTMLElement>('[data-touch="interact"]')
    talk.classList.toggle('is-ready', !!target)
    if (!target || this.screen !== 'hud') {
      prompt.hidden = true
      return
    }
    prompt.hidden = false
    const method = this.input.method
    const key = method === 'gamepad' ? 'Y' : 'E'
    this.q('.prompt-key').textContent = key
    this.q('.prompt-key').hidden = method === 'touch'
    this.q('.prompt-text').textContent = this.i18n.t(method === 'touch' ? 'hud.talkTouch' : method === 'gamepad' ? 'hud.talkGamepad' : 'hud.talkKeyboard')
  }

  // ─── dialog ──────────────────────────────────────────────────────────────

  showDialog(data: DialogData): void {
    this.promptEl.hidden = true
    this.hintEl.hidden = true
    const name = escapeHtml(data.name)
    this.q('.dialog-avatar').textContent = name.slice(0, 1)
    this.q('.dialog-avatar').style.setProperty('--accent', data.accent)
    this.q('.dialog-name').textContent = data.name
    this.q('.dialog-title').textContent = data.title
    this.q('.dialog-text').textContent = data.text
    this.dialogVoice = data.voiceLine
    this.q<HTMLButtonElement>('[data-dialog-replay]').hidden = !data.voiceLine
    const dots = Array.from({ length: data.need }, (_, i) => `<span class="dot ${i < Math.min(data.have, data.need) ? 'is-full' : ''}">${i < Math.min(data.have, data.need) ? ICON[data.item] : ''}</span>`).join('')
    this.q('.dialog-progress').innerHTML = `<span class="dialog-item">${ICON[data.item]}</span><span class="dialog-dots">${dots}</span><b>${Math.min(data.have, data.need)}/${data.need}</b>`
    const button = this.q<HTMLButtonElement>('.dialog-button')
    button.dataset.dialog = data.action
    button.textContent = this.i18n.t(data.action === 'accept' ? 'dialog.accept' : data.action === 'turnin' ? 'dialog.turnin' : 'dialog.close')
    this.setScreen('dialog')
    this.audio.play('ui')
    if (data.voiceLine) this.audio.playDialog(data.voiceLine)
  }

  hideDialog(): void {
    this.audio.stopDialog()
    this.dialogVoice = undefined
    this.setScreen('hud')
  }

  // ─── effects ─────────────────────────────────────────────────────────────

  popup(text: string, at: { x: number; y: number }, kind: 'item' | 'quest'): void {
    const el = document.createElement('div')
    el.className = `popup popup-${kind}`
    el.textContent = text
    el.style.left = `${at.x}px`
    el.style.top = `${at.y}px`
    this.q('.popups').appendChild(el)
    window.setTimeout(() => el.remove(), 1300)
  }

  questDone(id: QuestId): void {
    const quest = questOf(this.content, id)
    if (!quest) return
    const banner = this.q<HTMLElement>('.banner')
    banner.innerHTML = `<span class="banner-icon">${CHECK}</span><span><b>${this.i18n.t('hud.questComplete')}</b><small>${escapeHtml(this.i18n.t(quest.titleKey))}</small></span>`
    banner.hidden = false
    banner.classList.add('is-show')
    this.bannerTimer = 3
    this.audio.play('win')
  }

  // ─── results & boards ────────────────────────────────────────────────────

  showResults(journey: JourneyState, record = true): void {
    this.lastJourney = journey
    this.setLevel(journey.level)
    if (record) {
      const entry = { name: this.save.data.playerName, score: journey.score, seconds: Math.round(journey.elapsed), at: Date.now() }
      const { board, rank } = insertScore(this.save.data.leaderboard, entry)
      this.save.update({ leaderboard: board })
      this.savedRank = rank
    }
    this.q('.results-title').textContent = this.i18n.t(this.content.resultsWonKey)
    this.q('.results-thanks').textContent = this.i18n.t(this.content.resultsThanksKey)
    this.q('.results-stars').innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="result-star ${i < starsOf(journey) ? 'is-on' : ''}">${STAR}</span>`).join('')
    const stats = [
      ['results.tasks', `${this.content.quests.filter(q => journey.quests[q.id] === 'done').length}/${this.content.quests.length}`],
      ['results.items', `${journey.totalCollected}/${this.content.totalItems}`],
      ['results.time', formatDuration(journey.elapsed)],
      ['results.score', journey.score.toLocaleString('ru-RU')],
    ]
    this.q('.results-stats').innerHTML = stats.map(([key, value]) => `<div class="result-stat"><span>${this.i18n.t(key)}</span><b>${value}</b></div>`).join('')
    this.q<HTMLElement>('.results-newbest').hidden = this.savedRank !== 0
    this.q('.results-newbest').textContent = this.i18n.t('results.newBest')
    const next = otherLevel(journey.level)
    const nextButton = this.q<HTMLButtonElement>('[data-action="switch-level"]')
    const unlocked = next === 'planet' ? this.save.data.planetUnlocked : next === 'clockwork' ? this.save.data.clockworkUnlocked : next === 'underwater' ? this.save.data.underwaterUnlocked : next === 'summit' ? this.save.data.summitUnlocked : true
    nextButton.hidden = !unlocked || journey.level === 'summit'
    this.q<HTMLElement>('.results').classList.toggle('is-final', journey.level === 'summit')
    nextButton.dataset.level = next
    nextButton.textContent = next === 'planet' ? this.i18n.t('results.nextLevel') : next === 'clockwork' ? this.i18n.t('results.nextClockwork') : next === 'underwater' ? this.i18n.t('results.nextUnderwater') : next === 'summit' ? this.i18n.t('results.nextSummit') : this.i18n.t('results.backToIsland')
    this.setScreen('results')
    this.setOnlineStatus('pending')
  }

  setOnlineStatus(state: OnlineState, message = '', rank?: number): void {
    this.onlineMessage = message
    const el = this.q<HTMLElement>('.online-status')
    const retry = this.q<HTMLButtonElement>('[data-action="retry-submit"]')
    el.className = `online-status is-${state}`
    if (state === 'pending') el.textContent = this.i18n.t('results.onlinePending')
    else if (state === 'saved') el.textContent = rank ? `${this.i18n.t('results.onlineSaved')} · ${this.i18n.t('results.rank', { rank })}` : this.i18n.t('results.onlineSaved')
    else if (state === 'unranked') el.textContent = this.i18n.t('leaderboard.offline')
    else el.textContent = this.i18n.t('results.onlineError', { error: message })
    retry.hidden = state !== 'error'
  }

  setOnlineBoard(entries: OnlineEntry[] | null, state: 'loading' | 'ready' | 'error' | 'offline', message = ''): void {
    this.onlineEntries = entries
    this.onlineLoading = state === 'loading'
    this.onlineMessage = message
    this.renderOnlineBoard(state)
  }

  private renderOnlineBoard(state?: 'loading' | 'ready' | 'error' | 'offline'): void {
    const el = this.q<HTMLElement>('.board-online')
    const effective = state ?? (this.onlineLoading ? 'loading' : this.onlineEntries ? 'ready' : 'offline')
    if (effective === 'loading') {
      el.innerHTML = `<p class="board-note">${this.i18n.t('leaderboard.loading')}</p>`
      return
    }
    if (effective === 'error') {
      el.innerHTML = `<p class="board-note is-error">${this.i18n.t('leaderboard.error', { error: escapeHtml(this.onlineMessage) })}</p>`
      return
    }
    if (effective === 'offline' || !this.onlineEntries || this.onlineEntries.length === 0) {
      el.innerHTML = `<p class="board-note">${this.i18n.t(effective === 'offline' ? 'leaderboard.offline' : 'leaderboard.empty')}</p>`
      return
    }
    el.innerHTML = rows(this.onlineEntries, this.i18n.t('leaderboard.name'), this.i18n.t('leaderboard.score'), this.i18n.t('leaderboard.time'))
  }

  private renderLocalBoard(): void {
    const el = this.q<HTMLElement>('.board-local')
    if (this.save.data.leaderboard.length === 0) {
      el.innerHTML = `<p class="board-note">${this.i18n.t('leaderboard.empty')}</p>`
      return
    }
    const entries = this.save.data.leaderboard.map((entry, i) => ({ rank: i + 1, name: entry.name, score: entry.score, seconds: entry.seconds }))
    el.innerHTML = rows(entries, this.i18n.t('leaderboard.name'), this.i18n.t('leaderboard.score'), this.i18n.t('leaderboard.time'))
  }

  private refreshLevelButtons(): void {
    for (const [level, unlocked] of [['planet', this.save.data.planetUnlocked], ['clockwork', this.save.data.clockworkUnlocked], ['underwater', this.save.data.underwaterUnlocked], ['summit', this.save.data.summitUnlocked] ] as const) {
      const button = this.q<HTMLButtonElement>(`[data-action="play-${level}"]`)
      button.disabled = !unlocked
      button.classList.toggle('is-locked', !unlocked)
      button.title = unlocked ? '' : this.i18n.t(`level.${level}.locked`)
    }
  }

  private renderBest(): void {
    const best = this.save.data.leaderboard[0]
    this.q<HTMLElement>('.best').textContent = best ? this.i18n.t('menu.best', { score: best.score.toLocaleString('ru-RU') }) : ''
    for (const el of this.root.querySelectorAll<HTMLInputElement>('[data-field="playerName"]')) {
      if (document.activeElement !== el) el.value = this.save.data.playerName
    }
  }

  // ─── settings ────────────────────────────────────────────────────────────

  refreshSettings(): void {
    const d = this.save.data
    this.q<HTMLInputElement>('[data-setting="musicVolume"]').value = String(Math.round(d.musicVolume * 100))
    this.q<HTMLInputElement>('[data-setting="sfxVolume"]').value = String(Math.round(d.sfxVolume * 100))
    this.q<HTMLInputElement>('[data-setting="sensitivity"]').value = String(Math.round(d.sensitivity * 100))
    this.q<HTMLInputElement>('[data-field="playerName"]').value = d.playerName
    for (const input of this.root.querySelectorAll<HTMLInputElement>('[data-toggle]')) {
      input.checked = Boolean(d[input.dataset.toggle as keyof SaveData])
    }
    this.root.querySelectorAll<HTMLElement>('.seg [data-value]').forEach(btn => {
      btn.classList.toggle('is-on', btn.dataset.value === d.quality)
    })
    this.updateOutputs()
  }

  private updateOutputs(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-out]')) {
      const name = el.dataset.out as 'music' | 'sfx' | 'sensitivity'
      const value = name === 'music' ? this.save.data.musicVolume : name === 'sfx' ? this.save.data.sfxVolume : this.save.data.sensitivity
      el.textContent = `${Math.round(value * 100)}%`
    }
  }

  // ─── navigation ──────────────────────────────────────────────────────────

  frame(frameSeconds: number): void {
    if (this.lastMethod !== this.input.method) {
      this.lastMethod = this.input.method
      this.updateHint()
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= frameSeconds
      if (this.bannerTimer <= 0) {
        this.q('.banner').classList.remove('is-show')
        window.setTimeout(() => (this.q<HTMLElement>('.banner').hidden = true), 300)
      }
    }
    if (this.screen === 'hud' || this.screen === 'boot') return
    if (this.input.method === 'gamepad') {
      const x = this.input.move.x
      const y = this.input.move.y
      if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
        this.navRepeat -= frameSeconds
        if (this.navRepeat <= 0) {
          this.moveFocus(x, y)
          this.navRepeat = 0.2
        }
      } else {
        this.navRepeat = 0
      }
      if (this.input.consume('confirm')) {
        const active = document.activeElement as HTMLElement | null
        if (active && typeof active.matches === 'function' && active.matches('.btn, .seg button, .toggle, .level-card, [data-nav]')) active.click()
      }
      if (this.input.consume('back')) this.back()
    }
  }

  moveFocus(x: number, y: number): void {
    const items = this.navItems()
    if (items.length === 0) return
    const active = document.activeElement as HTMLElement | null
    const index = items.indexOf(active!)
    if (index < 0) {
      items[0]!.focus({ preventScroll: true })
      return
    }
    const rect = active!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let best: { el: HTMLElement; score: number } | null = null
    for (const el of items) {
      if (el === active) continue
      const r = el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - cx
      const dy = r.top + r.height / 2 - cy
      const along = dx * x + dy * y
      if (along <= 8) continue
      const across = Math.abs(dx * y - dy * x)
      const score = along + across * 2
      if (!best || score < best.score) best = { el, score }
    }
    ;(best?.el ?? active!)?.focus({ preventScroll: true })
  }

  private navItems(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-screen].is-active .btn, [data-screen].is-active .seg button, [data-screen].is-active .toggle, [data-screen].is-active .level-card, [data-screen].is-active input:not([type="hidden"])')]
      .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null && !(el as HTMLButtonElement).disabled)
  }

  private onKey(event: KeyboardEvent): void {
    if (event.code !== 'Escape' && (event.target as HTMLElement | null)?.matches('input[type="text"], input:not([type]), textarea')) return
    if (event.code === 'Escape') {
      if (this.screen === 'dialog' || this.screen === 'settings' || this.screen === 'leaderboard' || this.screen === 'pause') {
        this.input.consume('pause')
      }
      if (this.screen === 'dialog') this.actions.dialog('close')
      else if (this.screen === 'settings' || this.screen === 'leaderboard' || this.screen === 'pause') this.back()
    }
  }

  // ─── events ──────────────────────────────────────────────────────────────

  private onClick(event: Event): void {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-dialog], [data-dialog-replay], [data-setting], [data-toggle]')
    if (!el) return
    this.audio.unlock()
    if (el.dataset.dialogReplay !== undefined && this.dialogVoice) {
      this.audio.playDialog(this.dialogVoice)
      return
    }
    const action = el.dataset.action
    if (action) {
      if ((el as HTMLButtonElement).disabled) return
      this.audio.play('ui')
      if (action === 'play') this.actions.play('island')
      else if (action === 'play-planet') this.actions.play('planet')
      else if (action === 'play-clockwork') this.actions.play('clockwork')
      else if (action === 'play-underwater') this.actions.play('underwater')
      else if (action === 'play-summit') this.actions.play('summit')
      else if (action === 'switch-level') this.actions.play((el.dataset.level as LevelId) ?? otherLevel(this.level))
      else if (action === 'pause') this.actions.pause()
      else if (action === 'resume') this.actions.resume()
      else if (action === 'restart') this.actions.restart()
      else if (action === 'quit') this.actions.quit()
      else if (action === 'settings') this.push('settings')
      else if (action === 'leaderboard') this.push('leaderboard')
      else if (action === 'back') this.back()
      else if (action === 'retry-boot') window.location.reload()
      else if (action === 'retry-submit') this.actions.retrySubmit()
      return
    }
    const dialog = el.dataset.dialog as DialogAction | undefined
    if (dialog) {
      this.actions.dialog(dialog)
      return
    }
    if (el.dataset.setting === 'quality' && el.dataset.value) {
      this.audio.play('ui')
      this.actions.settings({ quality: el.dataset.value as Quality })
      this.refreshSettings()
    }
  }

  private onInput(event: Event): void {
    const el = event.target as HTMLInputElement
    if (el.matches('[data-field="playerName"]')) {
      const name = el.value.trim().slice(0, 16) || 'Дружок'
      this.actions.settings({ playerName: name })
      return
    }
    const setting = el.dataset.setting
    if (setting === 'musicVolume' || setting === 'sfxVolume') {
      const value = Number(el.value) / 100
      this.actions.settings(setting === 'musicVolume' ? { musicVolume: value } : { sfxVolume: value })
      this.updateOutputs()
    } else if (setting === 'sensitivity') {
      this.actions.settings({ sensitivity: Number(el.value) / 100 })
      this.updateOutputs()
    } else if (el.dataset.toggle) {
      const key = el.dataset.toggle as keyof SaveData
      if (key === 'muted' || key === 'invertY' || key === 'reducedMotion') this.actions.settings({ [key]: el.checked })
    }
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private translate(): void {
    document.documentElement.lang = 'ru'
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-i18n]')) {
      el.textContent = this.i18n.t(el.dataset.i18n!)
    }
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
      el.setAttribute('placeholder', this.i18n.t(el.dataset.i18nPlaceholder!))
    }
  }

  private q<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!
  }
}

function template(): string {
  return `
  <section class="boot" data-screen="boot">
    <div class="boot-card">
      <div class="boot-mark">${STAR}</div>
      <h1 class="boot-title">Мивлло</h1>
      <p class="boot-sub">и Чудо-остров</p>
      <div class="boot-bar"><i></i></div>
      <p class="boot-status" data-i18n="boot.loading"></p>
      <p class="boot-error" hidden></p>
      <button class="btn primary boot-retry" data-action="retry-boot" data-i18n="boot.retry" hidden></button>
    </div>
  </section>

  <section class="title" data-screen="title">
    <div class="title-shade"></div>
    <div class="title-card">
      <div class="logo">
        <span class="logo-text">МИВЛЛО</span>
        <span class="logo-small">И ЧУДО-ОСТРОВ</span>
      </div>
      <p class="tagline" data-i18n="game.tagline"></p>
      <label class="name-field"><span data-i18n="menu.nameLabel"></span>
        <input data-field="playerName" maxlength="16" autocomplete="off" spellcheck="false" data-i18n-placeholder="menu.namePlaceholder" />
        <small class="privacy-note" data-i18n="menu.namePrivacy"></small>
      </label>
      <div class="level-picker">
        <button class="level-card" data-action="play" data-nav>
          <span class="level-art island" aria-hidden="true"><i class="level-sun"></i><i class="level-hill"></i><i class="level-tree"></i></span>
          <span class="level-copy"><b data-i18n="level.island.title"></b><small data-i18n="level.island.subtitle"></small></span>
        </button>
        <button class="level-card planet" data-action="play-planet" data-nav>
          <span class="level-art planet" aria-hidden="true"><i class="level-giant"></i><i class="level-ring"></i><i class="level-star s1"></i><i class="level-star s2"></i><i class="level-star s3"></i></span>
          <span class="level-copy"><b data-i18n="level.planet.title"></b><small data-i18n="level.planet.subtitle"></small></span>
          <span class="level-lock" data-i18n="level.planet.locked"></span>
        </button>
        <button class="level-card clockwork" data-action="play-clockwork" data-nav>
          <span class="level-art clockwork" aria-hidden="true"><i class="level-gear"></i><i class="level-pipe"></i><i class="level-steam"></i></span>
          <span class="level-copy"><b data-i18n="level.clockwork.title"></b><small data-i18n="level.clockwork.subtitle"></small></span>
          <span class="level-lock" data-i18n="level.clockwork.locked"></span>
        </button>
        <button class="level-card underwater" data-action="play-underwater" data-nav>
          <span class="level-art underwater" aria-hidden="true"><i class="level-coral"></i><i class="level-bubble"></i><i class="level-wave"></i></span>
          <span class="level-copy"><b data-i18n="level.underwater.title"></b><small data-i18n="level.underwater.subtitle"></small></span>
          <span class="level-lock" data-i18n="level.underwater.locked"></span>
        </button>
        <button class="level-card summit" data-action="play-summit" data-nav><span class="level-art summit" aria-hidden="true"><i class="level-mountain"></i><i class="level-spark"></i></span><span class="level-copy"><b data-i18n="level.summit.title"></b><small data-i18n="level.summit.subtitle"></small></span><span class="level-lock" data-i18n="level.summit.locked"></span></button>
      </div>
      <div class="menu-buttons">
        <button class="btn" data-action="leaderboard" data-nav data-i18n="menu.leaderboard"></button>
        <button class="btn" data-action="settings" data-nav data-i18n="menu.settings"></button>
      </div>
      <p class="best"></p>
    </div>
    <p class="title-foot" data-i18n="credits.fonts"></p>
  </section>

  <section class="hud" data-screen="hud">
    <div class="hud-top">
      <div class="tasks panel">
        <h2><span data-i18n="hud.tasks"></span><b class="tasks-count">0/0</b></h2>
        <div class="task-list"></div>
      </div>
      <div class="hud-right">
        <button class="icon-btn" data-action="pause" data-nav aria-label="Пауза"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="2" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="2" fill="currentColor"/></svg></button>
        <div class="inventory panel"></div>
      </div>
    </div>
    <div class="compass" hidden><span class="compass-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21l-8-5-8 5Z" fill="currentColor"/></svg></span><span class="compass-label"></span></div>
    <div class="hint" hidden><span class="hint-glyph"></span><span class="hint-text"></span></div>
    <div class="prompt" hidden><span class="prompt-key">E</span><span class="prompt-text"></span></div>
    <div class="banner" hidden></div>
    <div class="touch" aria-label="Сенсорное управление">
      <div class="touch-move-pad" aria-label="Джойстик движения">
        <div class="touch-stick" aria-hidden="true"><i></i></div>
      </div>
      <div class="touch-look-cue" aria-hidden="true">Проведи справа<br>для камеры</div>
      <div class="touch-buttons">
        <button class="touch-btn talk" data-touch="interact" aria-label="Говорить"><span data-i18n="touch.talk"></span></button>
        <button class="touch-btn jump" data-touch="jump" aria-label="Прыжок"><span data-i18n="touch.jump"></span></button>
      </div>
    </div>
  </section>

  <section class="dialog" data-screen="dialog">
    <div class="dialog-backdrop"></div>
    <div class="dialog-card">
      <div class="dialog-avatar"></div>
      <div class="dialog-body">
        <p class="dialog-name"></p>
        <h2 class="dialog-title"></h2>
        <p class="dialog-text"></p>
        <div class="dialog-progress"></div>
        <div class="dialog-actions">
          <button class="dialog-replay" data-dialog-replay type="button" aria-label="Повторить озвучку">↻ <span>Повторить</span></button>
          <button class="btn primary dialog-button" data-dialog="close" data-nav></button>
        </div>
      </div>
    </div>
  </section>

  <section class="modal" data-screen="pause">
    <div class="modal-card">
      <h1 data-i18n="pause.title"></h1>
      <div class="stack">
        <button class="btn primary" data-action="resume" data-nav data-i18n="menu.continue"></button>
        <button class="btn" data-action="settings" data-nav data-i18n="menu.settings"></button>
        <button class="btn" data-action="restart" data-nav data-i18n="menu.restart"></button>
        <button class="btn" data-action="quit" data-nav data-i18n="menu.quit"></button>
      </div>
    </div>
  </section>

  <section class="modal" data-screen="settings">
    <div class="modal-card settings-card">
      <h1 data-i18n="settings.title"></h1>
      <div class="settings-scroll">
        <fieldset><legend data-i18n="settings.audio"></legend>
          <label class="range"><span data-i18n="settings.music"></span><input type="range" min="0" max="100" data-setting="musicVolume" /><b data-out="music"></b></label>
          <label class="range"><span data-i18n="settings.sfx"></span><input type="range" min="0" max="100" data-setting="sfxVolume" /><b data-out="sfx"></b></label>
          <label class="toggle"><span data-i18n="settings.mute"></span><input type="checkbox" data-toggle="muted" /><i></i></label>
        </fieldset>
        <fieldset><legend data-i18n="settings.controls"></legend>
          <label class="range"><span data-i18n="settings.sensitivity"></span><input type="range" min="20" max="300" data-setting="sensitivity" /><b data-out="sensitivity"></b></label>
          <label class="toggle"><span data-i18n="settings.invertY"></span><input type="checkbox" data-toggle="invertY" /><i></i></label>
        </fieldset>
        <fieldset><legend data-i18n="settings.display"></legend>
          <div class="setting-row"><span data-i18n="settings.quality"></span>
            <div class="seg"><button data-setting="quality" data-value="low" data-nav data-i18n="settings.quality.low"></button><button data-setting="quality" data-value="medium" data-nav data-i18n="settings.quality.medium"></button><button data-setting="quality" data-value="high" data-nav data-i18n="settings.quality.high"></button></div>
          </div>
          <label class="toggle"><span data-i18n="settings.reducedMotion"></span><input type="checkbox" data-toggle="reducedMotion" /><i></i></label>
        </fieldset>
        <fieldset><legend data-i18n="settings.playerName"></legend>
          <input class="name-input" data-field="playerName" maxlength="16" autocomplete="off" spellcheck="false" data-i18n-placeholder="menu.namePlaceholder" />
          <small class="privacy-note" data-i18n="menu.namePrivacy"></small>
        </fieldset>
      </div>
      <button class="btn primary" data-action="back" data-nav data-i18n="menu.back"></button>
    </div>
  </section>

  <section class="modal board-modal" data-screen="leaderboard">
    <div class="modal-card board-card">
      <h1 data-i18n="leaderboard.title"></h1>
      <div class="boards">
        <div><h3 data-i18n="leaderboard.local"></h3><div class="board-local board-list"></div></div>
        <div><h3 data-i18n="leaderboard.online"></h3><div class="board-online board-list"></div></div>
      </div>
      <button class="btn primary" data-action="back" data-nav data-i18n="menu.back"></button>
    </div>
  </section>

  <section class="modal results" data-screen="results">
    <div class="results-card">
      <div class="final-fireworks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="results-stars"></div>
      <h1 class="results-title"></h1>
      <p class="results-thanks"></p><h2 class="final-congrats" data-i18n="final.congrats"></h2><p class="final-sub" data-i18n="final.sub"></p>
      <p class="results-newbest" hidden></p>
      <div class="results-stats"></div>
      <p class="online-status"></p>
      <div class="stack row">
        <button class="btn retry-submit" data-action="retry-submit" data-nav data-i18n="results.retrySubmit" hidden></button>
        <button class="btn primary" data-action="restart" data-nav data-i18n="results.retry"></button>
        <button class="btn planet-next" data-action="switch-level" data-nav hidden></button>
        <button class="btn" data-action="quit" data-nav data-i18n="results.title"></button>
      </div>
    </div>
  </section>

  <div class="popups"></div>
  `
}

function rows(entries: OnlineEntry[], nameLabel: string, scoreLabel: string, timeLabel: string): string {
  const head = `<div class="board-row board-head"><span>#</span><span>${escapeHtml(nameLabel)}</span><span>${escapeHtml(scoreLabel)}</span><span>${escapeHtml(timeLabel)}</span></div>`
  const body = entries.map(entry => `<div class="board-row"><span class="rank">${entry.rank}</span><span class="board-name">${escapeHtml(entry.name)}</span><span class="board-score">${entry.score.toLocaleString('ru-RU')}</span><span class="board-time">${entry.seconds === null ? '—' : formatDuration(entry.seconds)}</span></div>`).join('')
  return head + body
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}
