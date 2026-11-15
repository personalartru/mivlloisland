import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import { insertScore, type Quality, type SaveData, type SaveStore } from '../engine/save'
import type { CompassTarget, DialogAction, DialogData, DialogVoiceLine, Hint } from '../game/game'
import { ITEMS, ITEM_KINDS, QUESTS, questById, type QuestId } from '../game/quests'
import { formatDuration, starsOf, type JourneyState } from '../game/rules'
import type { NpcInfo } from '../game/npcs'
import type { LevelId } from '../game/levels'

export type Screen = 'boot' | 'title' | 'hud' | 'pause' | 'settings' | 'leaderboard' | 'results' | 'dialog'

export type OnlineState = 'pending' | 'saved' | 'error' | 'unranked'

export type OnlineEntry = { rank: number; name: string; score: number; seconds: number | null }

export type UiActions = {
  play(level: LevelId): void
  startPlanet(): void
  pause(): void
  resume(): void
  restart(): void
  quit(): void
  settings(patch: Partial<SaveData>): void
  dialog(action: DialogAction): void
  loadLeaderboard(): void
  retrySubmit(): void
}

const ICON = {
  berry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-4.6 0-7.6-3.3-7.6-7.1 0-3.3 2.2-6.2 5.2-7.2l2.4-.8 2.4.8c3 .9 5.2 3.9 5.2 7.2C19.6 17.7 16.6 21 12 21Z" fill="#ff5a6e"/><path d="M12 6.5c-.8-1.9-2.4-3-4.5-3.2.2 2.2 1.4 3.7 3.3 4.4ZM12 6.5c.8-1.9 2.4-3 4.5-3.2-.2 2.2-1.4 3.7-3.3 4.4Z" fill="#5fc45f"/><g fill="#fff1c9"><circle cx="9" cy="13" r=".8"/><circle cx="14" cy="12" r=".8"/><circle cx="12" cy="17" r=".8"/></g></svg>',
  crystal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8 19 9l-3.3 12.2H8.3L5 9Z" fill="#69d7ff"/><path d="M12 1.8 19 9l-7 2.4Z" fill="#c6f4ff"/><path d="m5 9 7 2.4L8.3 21.2Z" fill="#3eb7e8"/></svg>',
  mushroom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 13h5.2l-.7 8H10Z" fill="#fff0d4"/><path d="M12 3C6.7 3 2.8 7.3 2.8 12c0 1.2.8 2 2 2h14.4c1.2 0 2-.8 2-2C21.2 7.3 17.3 3 12 3Z" fill="#ff7a55"/><g fill="#fff6e5"><circle cx="8" cy="8.5" r="1.4"/><circle cx="15.8" cy="7.8" r="1.1"/><circle cx="16.8" cy="11" r=".9"/></g></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.6 3.1 6.5 7.1.9-5.2 4.9 1.4 7L12 17.5 5.6 20.9l1.4-7L1.8 9l7.1-.9Z" fill="#ffd24a" stroke="#fff6cf" stroke-width="1.1"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12.8 5.2 5.2L20 6.8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="2" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="2" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21l-8-5-8 5Z" fill="currentColor"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.8 2.2 7.2L21.5 12l-7.3 3L12 22.2 9.8 15 2.5 12l7.3-3Z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5 20 12 8 19.5Z" fill="currentColor"/></svg>',
}

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
  private readonly root: HTMLElement
  private readonly promptEl: HTMLElement
  private readonly hintEl: HTMLElement
  private readonly stack: Screen[] = []
  private readonly hudCache = new Map<string, string>()
  private hintKey: Hint | null = null
  private lastJourney?: JourneyState
  private lastLevel: LevelId = 'island'
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
      if ((event.target as HTMLElement).matches('.btn, .seg button, .toggle')) this.audio.play('ui')
    })
    window.addEventListener('keydown', event => this.onKey(event))
    i18n.onChange(() => {
      this.translate()
      this.refreshSettings()
      if (this.lastJourney) this.showResults(this.lastJourney, this.lastLevel, false)
    })
    this.lastMethod = input.method
    this.translate()
    this.refreshSettings()
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
    this.renderInventory(journey)
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
    this.q('.hint-text').textContent = this.i18n.t(`hint.${this.hintKey}.${method}`)
  }

  private renderTasks(journey: JourneyState): void {
    const visible = QUESTS.filter(q => journey.quests[q.id] !== 'available')
    const key = visible.map(q => `${q.id}:${journey.quests[q.id]}:${journey.inventory[q.item]}`).join('|') + `:${visible.length === 0}`
    if (this.hudCache.get('tasks') === key) return
    this.hudCache.set('tasks', key)
    const list = this.q<HTMLElement>('.task-list')
    if (visible.length === 0) {
      list.innerHTML = `<p class="tasks-empty">${this.i18n.t('hud.noTasks')}</p>`
      return
    }
    list.innerHTML = visible.map(quest => {
      const status = journey.quests[quest.id]
      const have = Math.min(journey.inventory[quest.item], quest.need)
      return `<div class="task ${status === 'done' ? 'is-done' : ''}" style="--accent:${quest.accent}">
        <span class="task-avatar">${escapeHtml(this.i18n.t(quest.nameKey).slice(0, 1))}</span>
        <span class="task-copy"><b>${escapeHtml(this.i18n.t(quest.titleKey))}</b>
          <small>${status === 'done' ? this.i18n.t('hud.taskDone') : `${this.i18n.t(ITEMS[quest.item].nameKey)} · ${have}/${quest.need}`}</small></span>
        <span class="task-icon">${status === 'done' ? ICON.check : ICON[quest.item]}</span>
      </div>`
    }).join('')
  }

  private renderInventory(journey: JourneyState): void {
    const key = ITEM_KINDS.map(kind => journey.inventory[kind]).join(',')
    if (this.hudCache.get('inventory') === key) return
    this.hudCache.set('inventory', key)
    for (const kind of ITEM_KINDS) {
      const el = this.q<HTMLElement>(`[data-inv="${kind}"] b`)
      el.textContent = String(journey.inventory[kind])
      el.parentElement!.classList.toggle('is-empty', journey.inventory[kind] === 0)
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
      ? this.i18n.t('hud.compassItem', { item: this.i18n.t(ITEMS[compass.item ?? 'berry'].nameKey), m: Math.round(compass.distance) })
      : this.i18n.t('hud.compassNpc', { name: this.i18n.t(questById.get(compass.npc!)!.nameKey), m: Math.round(compass.distance) })
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
    const dots = Array.from({ length: data.need }, (_, i) => `<span class="dot ${i < Math.min(data.have, data.need) ? 'is-full' : ''}">${i < Math.min(data.have, data.need) ? ICON[data.item] : ''}</span>`).join('')
    this.q('.dialog-progress').innerHTML = `<span class="dialog-item">${ICON[data.item]}</span><span class="dialog-dots">${dots}</span><b>${Math.min(data.have, data.need)}/${data.need}</b>`
    const button = this.q<HTMLButtonElement>('.dialog-button')
    button.dataset.dialog = data.action
    button.textContent = this.i18n.t(data.action === 'accept' ? 'dialog.accept' : data.action === 'turnin' ? 'dialog.turnin' : 'dialog.close')
    this.setScreen('dialog')
    this.audio.play('ui')
    this.audio.playDialog(data.voiceLine)
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
    const quest = questById.get(id)!
    const banner = this.q<HTMLElement>('.banner')
    banner.innerHTML = `<span class="banner-icon">${ICON.check}</span><span><b>${this.i18n.t('hud.questComplete')}</b><small>${escapeHtml(this.i18n.t(quest.titleKey))}</small></span>`
    banner.hidden = false
    banner.classList.add('is-show')
    this.bannerTimer = 3
    this.audio.play('win')
  }

  // ─── results & boards ────────────────────────────────────────────────────

  showResults(journey: JourneyState, level: LevelId = 'island', record = true): void {
    this.lastJourney = journey
    this.lastLevel = level
    if (record) {
      const entry = { name: this.save.data.playerName, score: journey.score, seconds: Math.round(journey.elapsed), at: Date.now() }
      const { board, rank } = insertScore(this.save.data.leaderboard, entry)
      this.save.update({ leaderboard: board })
      this.savedRank = rank
    }
    this.q('.results-title').textContent = this.i18n.t('results.won')
    this.q('.results-thanks').textContent = this.i18n.t('results.thanks')
    this.q('.results-stars').innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="result-star ${i < starsOf(journey) ? 'is-on' : ''}">${ICON.star}</span>`).join('')
    const stats = [
      ['results.tasks', `${QUESTS.filter(q => journey.quests[q.id] === 'done').length}/${QUESTS.length}`],
      ['results.items', `${journey.totalCollected}/${QUESTS.reduce((n, q) => n + q.need, 0)}`],
      ['results.time', formatDuration(journey.elapsed)],
      ['results.score', journey.score.toLocaleString('ru-RU')],
    ]
    this.q('.results-stats').innerHTML = stats.map(([key, value]) => `<div class="result-stat"><span>${this.i18n.t(key)}</span><b>${value}</b></div>`).join('')
    this.q<HTMLElement>('.results-newbest').hidden = this.savedRank !== 0
    this.q('.results-newbest').textContent = this.i18n.t('results.newBest')
    this.q<HTMLButtonElement>('[data-action="next-level"]').hidden = level !== 'island' || !this.save.data.planetUnlocked
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
    const button = this.q<HTMLButtonElement>('[data-action="play-planet"]')
    button.disabled = !this.save.data.planetUnlocked
    button.title = this.save.data.planetUnlocked ? '' : this.i18n.t('level.planet.locked')
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
        if (active && typeof active.matches === 'function' && active.matches('.btn, .seg button, .toggle, [data-nav]')) active.click()
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
    return [...this.root.querySelectorAll<HTMLElement>('[data-screen].is-active .btn, [data-screen].is-active .seg button, [data-screen].is-active .toggle, [data-screen].is-active input:not([type="hidden"])')]
      .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null)
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
      this.audio.play('ui')
      if (action === 'play') this.actions.play('island')
      else if (action === 'play-planet') this.actions.play('planet')
      else if (action === 'next-level') this.actions.startPlanet()
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
      <div class="boot-mark">${ICON.star}</div>
      <h1 class="boot-title">Мурзик</h1>
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
        <span class="logo-text">МУРЗИК</span>
        <span class="logo-small">И ЧУДО-ОСТРОВ</span>
      </div>
      <p class="tagline" data-i18n="game.tagline"></p>
      <label class="name-field"><span data-i18n="menu.nameLabel"></span>
        <input data-field="playerName" maxlength="16" autocomplete="off" spellcheck="false" data-i18n-placeholder="menu.namePlaceholder" />
        <small class="privacy-note" data-i18n="menu.namePrivacy"></small>
      </label>
      <div class="menu-buttons">
        <button class="btn primary big" data-action="play" data-nav>${ICON.play}<span data-i18n="menu.play"></span></button>
        <button class="btn planet-level" data-action="play-planet" data-nav>${ICON.sparkle}<span data-i18n="menu.planet"></span></button>
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
        <h2 data-i18n="hud.tasks"></h2>
        <div class="task-list"></div>
      </div>
      <div class="hud-right">
        <button class="icon-btn" data-action="pause" data-nav aria-label="Пауза">${ICON.pause}</button>
        <div class="inventory panel">
          ${ITEM_KINDS.map(kind => `<div class="inv-item is-empty" data-inv="${kind}" title="${kind}"><span class="inv-icon">${ICON[kind]}</span><b>0</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="compass" hidden><span class="compass-arrow">${ICON.arrow}</span><span class="compass-label"></span></div>
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
      <div class="results-stars"></div>
      <h1 class="results-title"></h1>
      <p class="results-thanks"></p>
      <p class="results-newbest" hidden></p>
      <div class="results-stats"></div>
      <p class="online-status"></p>
      <div class="stack row">
        <button class="btn retry-submit" data-action="retry-submit" data-nav data-i18n="results.retrySubmit" hidden></button>
        <button class="btn primary" data-action="restart" data-nav data-i18n="results.retry"></button>
        <button class="btn planet-next" data-action="next-level" data-nav data-i18n="results.nextLevel" hidden></button>
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
