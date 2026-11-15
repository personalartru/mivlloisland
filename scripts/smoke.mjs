// End-to-end smoke test: builds must already exist in dist/ (`pnpm build`).
// Serves dist/, boots the game in headless Chromium, walks the menus, completes a real journey
// through the quest rules and writes screenshots to ./shots/.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })

const lock = JSON.parse(readFileSync('assets.lock.json', 'utf8'))
const storageFiles = new Map()
for (const [localPath, entry] of Object.entries(lock.assets ?? {})) {
  if (!entry?.path?.includes('/manus-storage/')) continue
  storageFiles.set(new URL(entry.path, 'http://local').pathname, resolve(localPath))
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false })
let browser
const guard = setTimeout(() => fail('timed out'), 180_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}
async function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

async function openGame(context, errors) {
  const page = await context.newPage()
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  page.on('response', r => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  // The published build reads models from managed storage; serve the same bytes locally in smoke.
  await page.route('**/manus-storage/**', route => {
    const file = storageFiles.get(new URL(route.request().url()).pathname)
    return file ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: 'missing smoke asset' })
  })
  await page.goto(url)
  await page.waitForSelector('[data-screen="title"].is-active', { timeout: 30_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const [selector, family] of [['.logo-text', 'Comfortaa'], ['.tagline', 'Nunito']]) {
      const actual = getComputedStyle(document.querySelector(selector)).fontFamily
      if (!actual.includes(family)) throw new Error(`Unexpected ${selector} font: ${actual}`)
      if (!document.fonts.check(`700 16px ${family}`)) throw new Error(`Bundled font did not load: ${family}`)
    }
  })
  await page.waitForTimeout(700)
  return page
}

const state = page => page.evaluate(() => {
  const { game } = window.__game
  const p = game.player.position
  return { mode: game.mode, journey: game.journey, pos: { x: p.x, y: p.y, z: p.z } }
})

async function completeJourney(page) {
  await page.evaluate(() => {
    const g = window.__game.game
    const plan = [['fairy', 'crystal'], ['grandma', 'berry'], ['mushroom', 'mushroom'], ['cat', 'star']]
    for (const [id, item] of plan) {
      if (g.journey.quests[id] === 'available') {
        g.openDialog(id)
        g.dialogAction('accept')
        g.closeDialog()
      }
      for (const p of g.items.remaining(item)) {
        const q = p.clone()
        q.y = 1
        g.player.teleport(q)
        g.step(1 / 60)
      }
      const n = g.npcs.positionOf(id).clone()
      n.z += 2.2
      n.y = 1
      g.player.teleport(n)
      g.step(1 / 60)
      g.openDialog(id)
      g.dialogAction('turnin')
      g.closeDialog()
    }
    g.step(3)
  })
}

try {
  await waitForServer()
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--ignore-gpu-blocklist'], channel: 'chrome' }))
  const errors = []

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'ru-RU' })
  const page = await openGame(desktop, errors)
  await page.screenshot({ path: `${out}/01-title.png` })

  await page.click('[data-action="play"]')
  await page.waitForSelector('[data-screen="hud"].is-active')
  const before = await state(page)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(700)
  await page.keyboard.press('Space')
  await page.waitForTimeout(900)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/02-gameplay.png` })
  const after = await state(page)
  const moved = Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z)
  if (after.mode !== 'playing') throw new Error(`expected playing, got ${after.mode}`)
  if (!(after.journey.elapsed > before.journey.elapsed + 1)) throw new Error('journey clock did not run')
  if (moved < 2) throw new Error(`player barely moved (${moved.toFixed(2)} m)`)
  console.log(`smoke: moved ${moved.toFixed(1)} m, journey ${after.journey.elapsed.toFixed(1)} s`)

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-screen="pause"]')?.classList.contains('is-active'), null, { polling: 100 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}/03-pause.png` })
  await page.click('[data-screen="pause"] [data-action="settings"]')
  await page.waitForFunction(() => document.querySelector('[data-screen="settings"]')?.classList.contains('is-active'), null, { polling: 100 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}/04-settings.png` })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-screen="pause"]')?.classList.contains('is-active'), null, { polling: 100 })
  await page.waitForTimeout(250)
  if ((await state(page)).mode !== 'paused') throw new Error('leaving Settings with Escape resumed the run')
  await page.click('[data-screen="pause"] [data-action="resume"]')
  await page.waitForFunction(() => document.querySelector('[data-screen="hud"]')?.classList.contains('is-active'), null, { polling: 100 })

  await completeJourney(page)
  await page.waitForFunction(() => document.querySelector('[data-screen="results"]')?.classList.contains('is-active'), null, { polling: 100, timeout: 10_000 })
  await page.waitForTimeout(1_200)
  await page.screenshot({ path: `${out}/05-results.png` })
  const done = await state(page)
  if (done.journey.phase !== 'won') throw new Error(`expected a won journey, got ${done.journey.phase}`)
  if (done.journey.score !== 4600) throw new Error(`unexpected friendship score: ${done.journey.score}`)
  await desktop.close()

  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' })
  const phonePage = await openGame(phone, errors)
  await phonePage.tap('[data-action="play"]')
  await phonePage.waitForSelector('[data-screen="hud"].is-active')
  await phonePage.waitForTimeout(1_200)
  await phonePage.screenshot({ path: `${out}/06-phone-hud.png` })
  await phone.close()

  if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — screenshots in ${out}/`)
} catch (err) {
  await fail(err?.message ?? String(err))
}
