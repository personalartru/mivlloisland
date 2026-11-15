import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { Quality } from '../engine/save'
import { FollowCamera } from './camera'
import { CONFIG } from './config'
import { contentFor, itemDef, questOf, type ItemKind, type LevelContent, type QuestId } from './content'
import { Effects } from './fx'
import { Items } from './items'
import type { ModelPack } from './models'
import { Npcs, type NpcInfo } from './npcs'
import { Player, type PlayerEvent } from './player'
import {
  acceptQuest, completedCount, createJourney, missingFor, pickup, tick, turnIn,
  type JourneyState, type QuestStatus,
} from './rules'
import { tuning } from './tuning'
import { createWorld, type WorldView } from './world'
import { itemFactory, npcVisuals } from './visuals'
import type { LevelId } from './levels'

export type Mode = 'attract' | 'playing' | 'talking' | 'paused' | 'ended'
export type Hint = 'move' | 'look' | 'talk' | 'collect'
export type DialogAction = 'accept' | 'turnin' | 'close'
export type DialogLine = 'intro' | 'progress' | 'ready' | 'thanks' | 'done'
export type DialogVoiceLine = `${QuestId}-${DialogLine}`

export type DialogData = {
  npcId: QuestId
  name: string
  title: string
  text: string
  item: ItemKind
  itemName: string
  have: number
  need: number
  status: QuestStatus
  action: DialogAction
  accent: string
  /** Every island line is voiced; each cosmic friend has a voiced greeting. */
  voiceLine?: DialogVoiceLine
}

export type CompassTarget = {
  angle: number
  distance: number
  kind: 'item' | 'npc'
  item?: ItemKind
  npc?: QuestId
}

export type GameHooks = {
  popup(text: string, screen: { x: number; y: number }, kind: 'item' | 'quest'): void
  hint(hint: Hint | null): void
  dialog(data: DialogData): void
  dialogClose(): void
  questDone(id: QuestId): void
  tutorialDone(): void
  end(journey: JourneyState, level: LevelId): void
}

/**
 * One playable level: owns the world, player, residents, collectibles and journey rules, and
 * translates simulation events into audio, particles and UI hooks. There is no timer, damage or
 * losing: the only end state is the celebration after every resident has been helped.
 */
export class Game {
  mode: Mode = 'attract'
  journey: JourneyState
  reducedMotion = false
  readonly level: LevelId
  readonly content: LevelContent
  private readonly physics: Physics
  private readonly world: WorldView
  private readonly player: Player
  private readonly cam: FollowCamera
  private readonly items: Items
  private readonly npcs: Npcs
  private readonly fx = new Effects()
  private simTime = 0
  private time = 0
  private tutorial: Hint | null = null
  private tutorialLook = 0
  private tutorialStart = new THREE.Vector3()
  private dialogNpc: QuestId | null = null
  private finishTimer = 0
  private savedYaw = 0
  private savedPitch = 0.32
  private readonly down = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly audio: Audio,
    private readonly i18n: I18n,
    private readonly hooks: GameHooks,
    models: ModelPack,
    level: LevelId = 'island',
  ) {
    this.level = level
    this.content = contentFor(level)
    this.physics = new Physics(CONFIG.player.gravity)
    this.world = createWorld(this.physics, renderer.shadowMapSize, models.props, level)
    this.player = new Player(this.physics, this.world.spawn, models.player)
    this.cam = new FollowCamera(this.physics, this.player.collider)
    this.items = new Items(this.content, itemFactory(this.content, models))
    this.npcs = new Npcs(this.physics, this.content, npcVisuals(this.content, models))
    this.world.scene.add(this.player.root, this.player.shadowMesh, this.items.group, this.npcs.group, this.fx.mesh)
    this.journey = createJourney(this.content)
    this.cam.reset(this.world.spawn, 0.6)
  }

  get camera(): THREE.PerspectiveCamera {
    return this.cam.camera
  }

  /** Begin (or restart) a journey. `tutorial` shows first-time control hints. */
  start(tutorial: boolean): void {
    tuning.activate('run')
    this.items.reset()
    this.fx.clear()
    this.world.setLanterns(0)
    this.player.teleport(this.world.spawn)
    this.player.facing = 0
    this.cam.pitch = 0.32
    this.cam.reset(this.world.spawn, 0)
    this.journey = { ...createJourney(this.content), unranked: tuning.unranked }
    this.mode = 'playing'
    this.dialogNpc = null
    this.finishTimer = 0
    this.input.endFrame()
    this.input.takeLook()
    this.tutorial = tutorial ? 'move' : null
    this.tutorialLook = 0
    this.tutorialStart.copy(this.world.spawn)
    this.hooks.hint(this.tutorial)
  }

  pause(): void {
    if (this.mode === 'playing' || this.mode === 'talking') this.mode = 'paused'
  }

  resume(): void {
    if (this.mode !== 'paused') return
    this.mode = this.dialogNpc ? 'talking' : 'playing'
    this.input.endFrame()
    this.input.takeLook()
  }

  toTitle(): void {
    this.mode = 'attract'
    this.dialogNpc = null
    this.hooks.hint(null)
  }

  setQuality(quality: Quality): void {
    this.renderer.applyQuality(quality)
    const size = this.renderer.shadowMapSize
    const shadow = this.world.sun.shadow
    shadow.map?.dispose()
    shadow.map = null
    shadow.mapSize.set(size, size)
    this.world.scene.traverse(obj => {
      const material = (obj as THREE.Mesh).material
      for (const m of Array.isArray(material) ? material : material ? [material] : []) m.needsUpdate = true
    })
  }

  step(dt: number): void {
    this.simTime += dt
    const jumpPressed = this.input.consume('jump')
    const interactPressed = this.input.consume('interact')
    const playing = this.mode === 'playing'

    if (playing) {
      const events: PlayerEvent[] = []
      this.player.step(
        dt,
        { moveX: this.input.move.x, moveY: this.input.move.y, sprint: this.input.held('sprint'), jumpPressed, jumpHeld: this.input.held('jump') },
        this.cam.yaw,
        events,
      )
      this.physics.step(dt)
      this.journey = tick(this.journey, dt)
      this.journey.unranked ||= tuning.unranked
      const pos = this.player.position
      for (const event of events) this.onPlayerEvent(event, pos)

      for (const got of this.items.collect(pos, CONFIG.quest.pickupRadius)) {
        this.journey = pickup(this.journey, got.kind, this.content).state
        const def = itemDef(this.content, got.kind)
        this.audio.play('pickup')
        this.fx.burst(got.at, def.color, 24, 6)
        this.hooks.popup(`+1 ${this.i18n.t(def.nameKey)}`, this.project(got.at.clone().setY(got.at.y + 0.6)), 'item')
        if (this.tutorial === 'collect') {
          this.advanceTutorial(null)
          this.hooks.tutorialDone()
        }
      }

      if (pos.y < -8) {
        // A soft rescue, never a punishment: the level has an invisible hedge, but a fall is safe.
        this.player.teleport(this.player.safe)
        this.cam.reset(this.player.safe)
      }

      const near = this.npcs.nearest(pos, CONFIG.quest.talkRadius)
      if (interactPressed && near) this.openDialog(near.id)

      if (this.tutorial === 'move' && pos.distanceTo(this.tutorialStart) > 2) {
        this.advanceTutorial(this.input.method === 'touch' ? 'talk' : 'look')
      }
    } else if (this.mode === 'talking') {
      this.physics.step(dt)
      this.journey = tick(this.journey, dt)
      this.journey.unranked ||= tuning.unranked
    } else if (this.mode === 'ended') {
      this.physics.step(dt)
    }

    if (this.finishTimer > 0) {
      this.finishTimer -= dt
      if (this.finishTimer <= 0) {
        this.mode = 'ended'
        this.hooks.hint(null)
        this.hooks.end(this.journey, this.level)
      }
    }
  }

  render(alpha: number, frameSeconds: number): void {
    this.time += frameSeconds
    this.physics.sync(alpha)
    const target = this.player.root.position
    const focus = this.mode === 'talking' && this.dialogNpc
      ? target.clone().add(this.npcs.positionOf(this.dialogNpc)).multiplyScalar(0.5).setY(1.15)
      : target
    if (this.mode === 'attract') {
      const t = this.time * 0.05 + 0.8
      const cam = this.cam.camera
      cam.position.set(Math.sin(t) * 42, 18 + Math.sin(this.time * 0.2) * 1.5, Math.cos(t) * 42)
      cam.lookAt(0, 4, 4)
    } else {
      const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }
      if (this.mode === 'playing' && this.tutorial === 'look') {
        this.tutorialLook += Math.abs(look.x) + Math.abs(look.y)
        if (this.tutorialLook > 0.05) this.advanceTutorial('talk')
      }
      this.cam.update(focus, look, frameSeconds, false, this.reducedMotion)
    }
    this.player.animate(frameSeconds, this.groundBelow(target))
    this.items.animate(frameSeconds)
    this.npcs.update(this.journey, target, frameSeconds, this.time)
    this.fx.update(frameSeconds)
    this.world.update(frameSeconds, target)
    this.renderer.render(this.world.scene, this.cam.camera)
  }

  /** Direction to the nearest current objective relative to the camera (HUD compass). */
  compass(): CompassTarget | null {
    const pos = this.player.root.position
    const active = this.content.quests.filter(q => this.journey.quests[q.id] === 'active')
    let target: THREE.Vector3 | undefined
    let kind: 'item' | 'npc' = 'item'
    let item: ItemKind | undefined
    let npc: QuestId | undefined

    const needing = active.find(q => missingFor(this.journey, q.id, this.content) > 0)
    if (needing) {
      const spot = this.items.nearest(needing.item, pos)
      if (spot) {
        target = spot
        item = needing.item
      }
    }
    if (!target) {
      const ready = active.filter(q => missingFor(this.journey, q.id, this.content) === 0)
      const pool = ready.length > 0 ? ready : this.content.quests.filter(q => this.journey.quests[q.id] === 'available')
      let best = Infinity
      for (const quest of pool) {
        const p = this.npcs.positionOf(quest.id)
        const d = p.distanceToSquared(pos)
        if (d < best) {
          best = d
          target = p
          kind = 'npc'
          npc = quest.id
        }
      }
    }
    if (!target) return null
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const toTarget = Math.atan2(-dx, -dz)
    let angle = toTarget - this.cam.yaw
    angle = Math.atan2(Math.sin(angle), Math.cos(angle))
    return { angle, distance: Math.hypot(dx, dz), kind, item, npc }
  }

  /** Resident close enough to talk to, for the interaction prompt. */
  get interactTarget(): NpcInfo | null {
    if (this.mode !== 'playing') return null
    return this.npcs.nearest(this.player.position, CONFIG.quest.talkRadius)
  }

  dialogAction(action: DialogAction): void {
    const id = this.dialogNpc
    if (!id) return
    if (action === 'accept') {
      this.journey = acceptQuest(this.journey, id).state
      this.audio.play('ui')
      this.hooks.dialog(this.dialogData(id, false))
      return
    }
    if (action === 'turnin') {
      const result = turnIn(this.journey, id, this.content)
      if (result.completed) {
        this.journey = result.state
        const quest = questOf(this.content, id)!
        const at = this.npcs.positionOf(id).setY(1)
        this.audio.play('quest')
        this.fx.burst(at, quest.accent, 42, 8)
        this.hooks.questDone(id)
        this.world.setLanterns(completedCount(this.journey, this.content))
        if (this.journey.phase === 'won') this.finishTimer = 2.2
        this.hooks.dialog(this.dialogData(id, true))
      }
      return
    }
    this.closeDialog()
  }

  private openDialog(id: QuestId): void {
    this.mode = 'talking'
    this.dialogNpc = id
    this.savedYaw = this.cam.yaw
    this.savedPitch = this.cam.pitch
    const npc = this.npcs.positionOf(id)
    this.cam.yaw = Math.atan2(this.player.position.x - npc.x, this.player.position.z - npc.z) + 0.5
    this.cam.pitch = 0.18
    this.player.velocity.set(0, 0, 0)
    this.input.endFrame()
    this.input.takeLook()
    this.input.unlockPointer()
    this.audio.play('talk')
    if (this.tutorial === 'talk') this.advanceTutorial('collect')
    this.hooks.hint(null)
    this.hooks.dialog(this.dialogData(id, false))
  }

  private closeDialog(): void {
    this.hooks.dialogClose()
    this.dialogNpc = null
    this.mode = 'playing'
    this.cam.yaw = this.savedYaw
    this.cam.pitch = this.savedPitch
    if (this.tutorial === 'collect') this.hooks.hint('collect')
    this.input.lockPointer()
    this.input.endFrame()
    this.input.takeLook()
  }

  private dialogData(id: QuestId, thanks: boolean): DialogData {
    const quest = questOf(this.content, id)!
    const status = this.journey.quests[id]
    const have = this.journey.inventory[quest.item]
    let text = this.i18n.t(quest.doneKey)
    let action: DialogAction = 'close'
    let line: DialogLine = 'done'
    if (thanks) {
      text = this.i18n.t(quest.thanksKey)
      line = 'thanks'
    } else if (status === 'available') {
      text = this.i18n.t(quest.introKey)
      action = 'accept'
      line = 'intro'
    } else if (status === 'active') {
      const missing = missingFor(this.journey, id, this.content)
      if (missing > 0) {
        text = this.i18n.t(quest.progressKey, { n: missing })
        line = 'progress'
      } else {
        text = this.i18n.t(quest.readyKey)
        action = 'turnin'
        line = 'ready'
      }
    }
    return {
      npcId: id,
      name: this.i18n.t(quest.nameKey),
      title: this.i18n.t(quest.titleKey),
      text,
      item: quest.item,
      itemName: this.i18n.t(itemDef(this.content, quest.item).nameKey),
      have,
      need: quest.need,
      status,
      action,
      accent: quest.accent,
      voiceLine: this.level === 'island' ? `${id}-${line}` : line === 'intro' ? `${id}-intro` : undefined,
    }
  }

  private onPlayerEvent(event: PlayerEvent, pos: THREE.Vector3): void {
    const feet = pos.clone().setY(pos.y - CONFIG.player.halfHeight - CONFIG.player.radius)
    if (event.type === 'jump') {
      this.audio.play('jump')
      this.fx.puff(feet, 0.3)
    } else if (event.type === 'land') {
      this.audio.play('land')
      this.fx.puff(feet, event.impact)
    }
  }

  private advanceTutorial(next: Hint | null): void {
    this.tutorial = next
    this.tutorialLook = 0
    this.hooks.hint(next)
  }

  private groundBelow(p: THREE.Vector3): number | null {
    this.down.origin = { x: p.x, y: p.y, z: p.z }
    const hit = this.physics.world.castRay(this.down, 30, true, undefined, undefined, this.player.collider)
    return hit ? p.y - hit.timeOfImpact : null
  }

  project(world: THREE.Vector3): { x: number; y: number } {
    const v = world.clone().project(this.cam.camera)
    const canvas = this.renderer.canvas
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight }
  }

  /** Exposed for the smoke test: a resident model's anchor position. */
  npcPosition(id: QuestId): THREE.Vector3 {
    return this.npcs.positionOf(id)
  }
}
