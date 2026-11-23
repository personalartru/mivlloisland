import * as THREE from 'three'
import type { ItemKind, QuestId } from './content'
import type { NpcVisual } from './visual-types'

const mat = (color: string, emissive = color) => new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .08, emissive, emissiveIntensity: .18 })
const fit = (g: THREE.Group, h: number) => { const box = new THREE.Box3().setFromObject(g); const size = box.getSize(new THREE.Vector3()); g.scale.setScalar(h / Math.max(size.y, .01)); return g }
const colors: Record<string, string> = { sage: '#c69cff', yeti: '#bff5ff', eagle: '#ff9a73', moon: '#ffe067', summit: '#fff1a8' }
const dark = mat('#27335f')

function eye(x: number, y: number, z = -.43): THREE.Mesh {
  const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), dark)
  e.position.set(x, y, z)
  return e
}
function arm(x: number, y: number, z: number, color: string, angle = 0): THREE.Mesh {
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .38, 4, 8), mat(color))
  a.position.set(x, y, z); a.rotation.z = angle
  return a
}

export function summitNpcVisual(id: QuestId): NpcVisual | undefined {
  if (!colors[id]) return undefined
  return { height: 2.05, bob: .025, hover: .08, collider: .55, build: () => {
    const g = new THREE.Group()
    const bodyMat = mat(colors[id])
    if (id === 'sage') {
      const robe = new THREE.Mesh(new THREE.ConeGeometry(.5, .95, 6), bodyMat); robe.position.y = .54; g.add(robe)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8), mat('#f0c7b0')); head.position.y = 1.2; g.add(head, eye(-.1, 1.24), eye(.1, 1.24))
      const hat = new THREE.Mesh(new THREE.ConeGeometry(.48, .62, 6), mat('#7b55b8')); hat.position.y = 1.72; hat.rotation.z = -.12; g.add(hat)
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 1.35, 8), mat('#d59cff')); staff.position.set(.52, .72, 0); staff.rotation.z = -.12; g.add(staff)
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(.14), mat('#7ce9e1', '#46dbe1')); orb.position.set(.57, 1.42, 0); g.add(orb)
    } else if (id === 'yeti') {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.46, .5, 6, 10), bodyMat); torso.position.y = .7; torso.scale.x = 1.08; g.add(torso)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8), bodyMat); head.position.y = 1.38; g.add(head)
      const horn = new THREE.Mesh(new THREE.ConeGeometry(.13, .42, 6), mat('#f2ffff')); horn.position.set(-.22, 1.72, -.02); horn.rotation.z = -.35; g.add(horn)
      const horn2 = horn.clone(); horn2.position.x = .22; horn2.rotation.z = .35; g.add(horn2)
      g.add(eye(-.13, 1.42), eye(.13, 1.42), arm(-.6, .7, 0, '#a8deeb', -.35), arm(.6, .7, 0, '#a8deeb', .35))
    } else if (id === 'eagle') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .5, 5, 9), bodyMat); body.position.y = .72; body.rotation.x = -.2; g.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), mat('#ffdca8')); head.position.set(0, 1.28, -.08); g.add(head, eye(-.1, 1.31), eye(.1, 1.31))
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.12, .34, 4), mat('#ffe067')); beak.position.set(0, 1.23, -.42); beak.rotation.x = -Math.PI / 2; g.add(beak)
      const wing = new THREE.Mesh(new THREE.ConeGeometry(.3, .9, 5), bodyMat); wing.position.set(.52, .78, 0); wing.rotation.z = Math.PI / 2; g.add(wing)
      const wing2 = wing.clone(); wing2.position.x = -.52; wing2.rotation.z = -Math.PI / 2; g.add(wing2)
      const tail = new THREE.Mesh(new THREE.ConeGeometry(.22, .65, 5), mat('#ffe0a8')); tail.position.set(0, .62, .48); tail.rotation.x = Math.PI / 2; g.add(tail)
    } else if (id === 'moon') {
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(.54, 1.1, 8), mat('#5f63c7')); cloak.position.y = .58; g.add(cloak)
      const face = new THREE.Mesh(new THREE.SphereGeometry(.36, 16, 10), mat('#ffe067', '#ffcf48')); face.position.set(0, 1.3, -.08); g.add(face, eye(-.1, 1.33), eye(.1, 1.33))
      const crescent = new THREE.Mesh(new THREE.TorusGeometry(.43, .09, 8, 18, Math.PI * 1.55), mat('#fff1a8', '#ffe067')); crescent.position.set(0, 1.72, 0); crescent.rotation.z = -.35; g.add(crescent)
      g.add(arm(-.58, .72, 0, '#8da8ff', -.3), arm(.58, .72, 0, '#8da8ff', .3))
    } else {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .48, 6, 10), bodyMat); torso.position.y = .7; g.add(torso)
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(.38, 1), bodyMat); head.position.y = 1.38; g.add(head, eye(-.11, 1.4), eye(.11, 1.4))
      const crown = new THREE.Mesh(new THREE.ConeGeometry(.46, .38, 5), mat('#ffe067', '#ffd24a')); crown.position.y = 1.82; g.add(crown)
      g.add(arm(-.52, .75, 0, '#ffcf7c', -.25), arm(.52, .75, 0, '#ffcf7c', .25))
    }
    return fit(g, 2.05)
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
