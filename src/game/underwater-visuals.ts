import * as THREE from 'three'
import type { ItemKind, QuestId } from './content'
import type { NpcVisual } from './visual-types'

const mat = (color: string, transparent = false, emissive = color) => new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .05, transparent, opacity: transparent ? .82 : 1, emissive, emissiveIntensity: .14 })
const fit = (g: THREE.Group, h: number) => { const box = new THREE.Box3().setFromObject(g); const size = box.getSize(new THREE.Vector3()); g.scale.setScalar(h / Math.max(size.y, .01)); return g }
const COLORS: Record<string, string> = { coralina: '#ff8a7e', octo: '#bc8cff', splash: '#69d9ee', pearl: '#ffe6a8', fin: '#6ed8a0' }
const dark = mat('#163b55')

function eye(x: number, y: number, z = -.43): THREE.Mesh {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), dark)
  e.position.set(x, y, z)
  return e
}
function fin(x: number, y: number, z: number, color: string, rz = 0): THREE.Mesh {
  const f = new THREE.Mesh(new THREE.ConeGeometry(.2, .62, 5), mat(color))
  f.position.set(x, y, z); f.rotation.z = rz
  return f
}

export function underwaterNpcVisual(id: QuestId): NpcVisual | undefined {
  if (!COLORS[id]) return undefined
  return { height: 1.85, bob: .035, hover: .1, collider: .5, build: () => {
    const g = new THREE.Group()
    const bodyMat = mat(COLORS[id])
    if (id === 'coralina') {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .5, 6, 10), bodyMat); torso.position.y = .65; g.add(torso)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 8), mat('#ffd2bb')); head.position.y = 1.25; g.add(head, eye(-.1, 1.28), eye(.1, 1.28))
      const crown = new THREE.Mesh(new THREE.ConeGeometry(.42, .52, 6), mat('#ff887b')); crown.position.y = 1.72; g.add(crown)
      for (let i = 0; i < 4; i++) { const branch = new THREE.Mesh(new THREE.CylinderGeometry(.045, .09, .5, 6), mat('#ffb1a6')); branch.position.set((i - 1.5) * .16, .35 + (i % 2) * .08, .08); branch.rotation.z = (i - 1.5) * .22; g.add(branch) }
    } else if (id === 'octo') {
      const head = new THREE.Mesh(new THREE.SphereGeometry(.48, 14, 10), bodyMat); head.scale.y = 1.12; head.position.y = 1.05; g.add(head, eye(-.14, 1.2), eye(.14, 1.2))
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .55, 4, 7), bodyMat); arm.position.set(Math.cos(a) * .35, .4, Math.sin(a) * .35); arm.rotation.z = Math.cos(a) * .6; arm.rotation.x = Math.sin(a) * .6; g.add(arm) }
      const spot = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat('#f0ddff')); spot.position.set(.28, 1.48, -.12); g.add(spot)
    } else if (id === 'splash') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .58, 6, 10), bodyMat); body.position.y = .75; body.rotation.x = -.16; g.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), mat('#d5f9ff')); head.position.set(0, 1.35, -.08); g.add(head, eye(-.1, 1.37), eye(.1, 1.37))
      g.add(fin(.52, .78, 0, '#81e7ff', Math.PI / 2), fin(-.52, .78, 0, '#81e7ff', -Math.PI / 2))
      const tail = new THREE.Mesh(new THREE.ConeGeometry(.22, .7, 5), mat('#81e7ff')); tail.position.set(0, .65, .5); tail.rotation.x = Math.PI / 2; g.add(tail)
    } else if (id === 'pearl') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9b3ff')); shell.position.y = .58; shell.rotation.x = Math.PI; g.add(shell)
      const face = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), mat('#fff0c4')); face.position.set(0, 1.18, -.08); g.add(face, eye(-.1, 1.2), eye(.1, 1.2))
      const tiara = new THREE.Mesh(new THREE.TorusGeometry(.34, .06, 6, 12), mat('#ffe6a8')); tiara.position.y = 1.55; tiara.rotation.x = Math.PI / 2; g.add(tiara)
    } else {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .5, 6, 10), bodyMat); torso.position.y = .7; g.add(torso)
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(.34, 1), bodyMat); head.position.y = 1.3; g.add(head, eye(-.1, 1.32), eye(.1, 1.32))
      g.add(fin(.5, .8, 0, '#a9f1ca', Math.PI / 2), fin(-.5, .8, 0, '#a9f1ca', -Math.PI / 2))
      const snorkel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .58, 7), mat('#d5f9ff')); snorkel.position.set(.28, 1.72, 0); snorkel.rotation.z = -.25; g.add(snorkel)
    }
    return fit(g, 1.85)
  } }
}

export function underwaterItem(kind: ItemKind): THREE.Group {
  const g = new THREE.Group(); const colors: Record<string, string> = { pearl: '#fff0c4', coral: '#ff887b', shell: '#d9b3ff', kelp: '#67d6a0', bubble: '#81e7ff' }; const c = mat(colors[kind] ?? '#fff', kind === 'bubble')
  if (kind === 'pearl') g.add(new THREE.Mesh(new THREE.SphereGeometry(.28, 14, 10), c))
  else if (kind === 'coral') { for (let i = 0; i < 4; i++) { const branch = new THREE.Mesh(new THREE.CylinderGeometry(.06, .12, .65, 7), c); branch.position.set((i - 1.5) * .15, .3, 0); branch.rotation.z = (i - 1.5) * .22; g.add(branch) } }
  else if (kind === 'shell') { const shell = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c); shell.rotation.x = Math.PI; g.add(shell) }
  else if (kind === 'kelp') { const stem = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .7, 4, 8), c); stem.rotation.z = .2; g.add(stem); const leaf = new THREE.SphereGeometry(.14, 8, 6); for (const side of [-1, 1]) { const blade = new THREE.Mesh(leaf, c); blade.scale.set(.6, 1.8, .45); blade.position.set(side * .15, .18, .02); blade.rotation.z = side * -.55; g.add(blade) } }
  else { g.add(new THREE.Mesh(new THREE.SphereGeometry(.32, 14, 10), c)); g.add(new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), c)).position.set(.28, .28, 0) }
  g.userData.tick = (time: number) => { g.rotation.y = time * .8; g.position.y = Math.sin(time * 2.2) * .08 }
  return g
}
