import type { Input } from '../engine/input'

/**
 * Tablet-first touch controls: a fixed left joystick, a right-side camera drag area and large
 * action buttons. The controls only receive pointer input while a playable run is active.
 */
export class TouchControls {
  private stickId: number | null = null
  private lookId: number | null = null
  private origin = { x: 0, y: 0 }
  private last = { x: 0, y: 0 }
  private readonly stick: HTMLElement
  private readonly knob: HTMLElement
  private readonly movePad: HTMLElement
  private readonly radius = 62

  constructor(root: HTMLElement, private readonly input: Input, private readonly active: () => boolean) {
    const layer = root.querySelector<HTMLElement>('.touch')!
    this.movePad = layer.querySelector('.touch-move-pad')!
    this.stick = layer.querySelector('.touch-stick')!
    this.knob = this.stick.querySelector('i')!

    const enable = () => document.body.classList.add('has-touch')
    if (matchMedia('(pointer: coarse)').matches) enable()
    window.addEventListener('touchstart', enable, { once: true, passive: true })
    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') this.input.method = 'touch'
    }, { capture: true })

    const padCenter = () => {
      const rect = this.movePad.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    const moveStick = (event: PointerEvent) => {
      let dx = event.clientX - this.origin.x
      let dy = event.clientY - this.origin.y
      const length = Math.hypot(dx, dy)
      if (length > this.radius) {
        dx = (dx / length) * this.radius
        dy = (dy / length) * this.radius
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`
      this.input.setTouchMove(dx / this.radius, -dy / this.radius)
    }

    this.movePad.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || !this.active() || this.stickId !== null) return
      event.preventDefault()
      this.stickId = event.pointerId
      this.origin = padCenter()
      this.movePad.setPointerCapture(event.pointerId)
      this.stick.classList.add('is-active')
      moveStick(event)
    })

    const canvas = document.querySelector<HTMLCanvasElement>('#game')!
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || !this.active() || this.lookId !== null) return
      // The left control pad owns movement; the unobstructed right side is always camera control.
      if (event.clientX < window.innerWidth * 0.38) return
      event.preventDefault()
      this.lookId = event.pointerId
      this.last = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    })

    window.addEventListener('pointermove', event => {
      if (event.pointerId === this.stickId) {
        event.preventDefault()
        moveStick(event)
      } else if (event.pointerId === this.lookId) {
        event.preventDefault()
        this.input.addTouchLook(event.clientX - this.last.x, event.clientY - this.last.y)
        this.last = { x: event.clientX, y: event.clientY }
      }
    }, { passive: false })

    const end = (event: PointerEvent) => {
      if (event.pointerId === this.stickId) {
        this.stickId = null
        this.knob.style.transform = ''
        this.stick.classList.remove('is-active')
        this.input.setTouchMove(0, 0)
      }
      if (event.pointerId === this.lookId) this.lookId = null
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)

    for (const button of layer.querySelectorAll<HTMLElement>('[data-touch]')) {
      const action = button.dataset.touch as 'jump' | 'interact'
      button.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' || !this.active()) return
        event.preventDefault()
        event.stopPropagation()
        button.setPointerCapture(event.pointerId)
        button.classList.add('is-down')
        this.input.setTouchButton(action, true)
      })
      const up = () => {
        button.classList.remove('is-down')
        this.input.setTouchButton(action, false)
      }
      button.addEventListener('pointerup', up)
      button.addEventListener('pointercancel', up)
    }
  }
}
