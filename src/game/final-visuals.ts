import * as THREE from 'three'
import type { ItemKind, QuestId } from './content'
import type { NpcVisual } from './visual-types'

const mat = (color: string, emissive = color) => new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .08, emissive, emissiveIntensity: .18 })
const fit = (g: THREE.Group, h: number) => { const box = new THREE.Box3().setFromObject(g); const size = box.getSize(new THREE.Vector3()); g.scale.setScalar(h / Math.max(size.y, .01)); return g }
const colors: Record<string, string> = { sage: '#c69cff', yeti: '#bff5ff', eagle: '#ff9a73', moon: '#ffe067', summit: '#fff1a8' }

export function summitNpcVisual(id: QuestId): NpcVisual | undefined {
  if (!colors[id]) return undefined
  return { height: 1.8, bob: .05, hover: .08, collider: .55, build: () => {
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(.52, 12, 9), mat(colors[id])); body.scale.y = 1.2; body.position.y = .65; g.add(body)
    if (id === 'eagle') { const wing = new THREE.Mesh(new THREE.ConeGeometry(.35, .8, 5), mat('#ffe0a8')); wing.rotation.z = Math.PI / 2; wing.position.set(.58, .75, 0); g.add(wing) }
    if (id === 'yeti') { const horn = new THREE.Mesh(new THREE.ConeGeometry(.14, .5, 6), mat('#f2ffff')); horn.position.set(-.25, 1.25, 0); g.add(horn); horn.clone().position.x = .25; g.add(horn.clone()) }
    for (const x of [-.14, .14]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), mat('#27335f')); eye.position.set(x, 1.02, -.43); g.add(eye) }
    return fit(g, 1.8)
  } }
}

export function summitItem(kind: ItemKind): THREE.Group {
  const g = new THREE.Group(); const c: Record<string, string> = { rune: '#d59cff', feather: '#8eeaff', ore: '#ff9b73', lantern: '#ffd65c', crown: '#ffe77a' }; const material = mat(c[kind] ?? '#fff')
  if (kind === 'rune') { const ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 8, 16), material); g.add(ring); g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.18), material)) }
  else if (kind === 'feather') { const stem = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .75, 4, 8), material); stem.rotation.z = -.35; g.add(stem); for (let i = 0; i < 5; i++) { const vane = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), material); vane.scale.x = .45; vane.position.set(-.12, .32 - i * .13, 0); vane.rotation.z = -.5; g.add(vane) } }
  else if (kind === 'ore') g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(.34, 0), material))
  else if (kind === 'lantern') { g.add(new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), material)); const halo = new THREE.Mesh(new THREE.TorusGeometry(.34, .04, 8, 16), material); halo.rotation.x = Math.PI / 2; g.add(halo) }
  else { const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .25, .18, 6), material); const point = new THREE.Mesh(new THREE.ConeGeometry(.32, .55, 6), material); point.position.y = .34; g.add(base, point) }
  g.userData.tick = (time: number) => { g.rotation.y = time * .8; g.position.y = Math.sin(time * 2.2) * .09 }
  return g
}
