import { copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const pagesBase = '/mivlloisland/'
const pagesOrigin = 'https://personalartru.github.io/mivlloisland'
const manuscriptOrigin = 'https://plyuhik-tznvprwr.manus.game'
const packageManager = process.env.npm_execpath
if (!packageManager) throw new Error('Run the GitHub Pages build through the package.json script')

const build = spawnSync(process.execPath, [packageManager, 'run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PAGES_BASE: pagesBase, VITE_GITHUB_PAGES: 'true' },
})
if (build.error) throw build.error
if (build.status !== 0) process.exit(build.status ?? 1)

const media = [
  ['assets/models/plyuhik-animated.glb', 'models/plyuhik-animated.glb'],
  ['assets/models/npc-grandma.glb', 'models/npc-grandma.glb'],
  ['assets/models/npc-fairy.glb', 'models/npc-fairy.glb'],
  ['assets/models/npc-mushroom.glb', 'models/npc-mushroom.glb'],
  ['assets/models/npc-cat.glb', 'models/npc-cat.glb'],
  ['assets/models/item-berry.glb', 'models/item-berry.glb'],
  ['assets/models/item-crystal.glb', 'models/item-crystal.glb'],
  ['assets/models/item-mushroom.glb', 'models/item-mushroom.glb'],
  ['assets/models/item-star.glb', 'models/item-star.glb'],
  ['assets/models/prop-tree.glb', 'models/prop-tree.glb'],
  ['assets/models/prop-cottage.glb', 'models/prop-cottage.glb'],
  ...[
    'magic/spell.wav', 'ui/ready-click-01.wav', 'magic/chimes.wav', 'magic/success.wav',
    'clockwork-city.mp3', 'clockwork-steam.mp3', 'clockwork-plate.mp3', 'clockwork-motor.mp3',
  ].map(name => [`${name.startsWith('clockwork-') ? 'public/audio' : 'assets/audio'}/${name}`, `audio/${name}`]),
]

for (const [source, destination] of media) {
  const sourcePath = join(root, source)
  const info = lstatSync(sourcePath)
  if (!info.isFile() || info.isSymbolicLink() || info.size === 0) throw new Error(`Required static media is not a regular file: ${source}`)
  const target = join(root, 'dist', destination)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(sourcePath, target)
  console.log(`[github-pages] ${basename(target)} (${info.size} bytes)`)
}

const indexPath = join(root, 'dist', 'index.html')
const index = readFileSync(indexPath, 'utf8')
if (!index.includes(manuscriptOrigin)) throw new Error('Expected Manus sharing URLs were not found in the built HTML')
const pagesIndex = index.replaceAll(manuscriptOrigin, pagesOrigin)
if (pagesIndex.includes(manuscriptOrigin) || !pagesIndex.includes(`${pagesOrigin}/share/`)) {
  throw new Error('GitHub Pages sharing URLs were not written correctly')
}
writeFileSync(indexPath, pagesIndex)

const snapshotPath = join(root, 'dist', 'game-sharing.json')
try {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  if (snapshot.publicationOrigin === manuscriptOrigin) {
    snapshot.publicationOrigin = pagesOrigin
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

writeFileSync(join(root, 'dist', '.nojekyll'), '')
console.log(`[github-pages] Ready at ${pagesOrigin}/ (local leaderboard only)`)
