import { copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const pagesBase = '/murzik/'
const pagesOrigin = 'https://personalartru.github.io/murzik'
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
  ...[
    'plyuhik-animated.glb',
    'npc-grandma.glb', 'npc-fairy.glb', 'npc-mushroom.glb', 'npc-cat.glb',
    'item-berry.glb', 'item-crystal.glb', 'item-mushroom.glb', 'item-star.glb',
    'prop-tree.glb', 'prop-cottage.glb',
  ].map(name => [`assets/models/${name}`, `models/${name}`]),
  ...[
    'magic/spell.wav', 'ui/ready-click-01.wav', 'magic/chimes.wav', 'magic/success.wav',
  ].map(name => [`assets/audio/${name}`, `audio/${name}`]),
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
