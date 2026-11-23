import * as THREE from 'three'
import { haloTexture } from '../textures'
import type { Physics } from '../../engine/physics'
import type { MazeLayout } from '../layout'

/** Mulberry32: tiny deterministic RNG so a level never changes between loads. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>()

/** Shared matte material for flat-shaded primitives (one material per colour). */
export function flat(color: THREE.Color): THREE.MeshStandardMaterial {
  const key = `flat:${color.getHexString()}`
  let m = materialCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0 })
    materialCache.set(key, m)
  }
  return m
}

/** Displace vertices so primitives read as hand-carved rock, keeping shared seams closed. */
export function jitter(geo: THREE.BufferGeometry, random: () => number, amount: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const offsets = new Map<string, THREE.Vector3>()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i)
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
    let o = offsets.get(key)
    if (!o) {
      o = new THREE.Vector3((random() - 0.5) * amount, (random() - 0.5) * amount, (random() - 0.5) * amount)
      offsets.set(key, o)
    }
    pos.setXYZ(i, v.x + o.x, v.y + o.y, v.z + o.z)
  }
  geo.computeVertexNormals()
}

export type SkyOptions = {
  top: string
  middle: string
  horizon: string
  sunDir: THREE.Vector3
  sunColor: string
  sunStrength?: number
  radius?: number
}

/** Three-stop gradient sky dome with a soft sun/moon glow. */
export function gradientSky({ top, middle, horizon, sunDir, sunColor, sunStrength = 1, radius = 450 }: SkyOptions): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      middle: { value: new THREE.Color(middle) },
      horizon: { value: new THREE.Color(horizon) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
      sunStrength: { value: sunStrength },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 middle; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunStrength;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = mix(horizon, middle, smoothstep(-0.05, 0.35, h));
        col = mix(col, top, smoothstep(0.3, 0.95, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += sunColor * (pow(s, 700.0) * 2.4 + pow(s, 12.0) * 0.16) * sunStrength;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat)
  sky.renderOrder = -1
  return sky
}

/** Twinkling point stars on a dome, one draw call. */
export function starField(count: number, inner: number, outer: number, size: number, seed = 1): THREE.Points {
  const random = rng(seed)
  const positions = new Float32Array(count * 3)
  const phases = new Float32Array(count)
  const scales = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const a = random() * Math.PI * 2
    const y = -0.15 + random() * 1.15
    const r = inner + random() * (outer - inner)
    const ring = Math.sqrt(Math.max(0.02, 1 - y * y))
    positions[i * 3] = Math.cos(a) * ring * r
    positions[i * 3 + 1] = y * r
    positions[i * 3 + 2] = Math.sin(a) * ring * r
    phases[i] = random() * Math.PI * 2
    scales[i] = size * (0.45 + random() * 0.9)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('scale', new THREE.BufferAttribute(scales, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color('#fff6e0') } },
    vertexShader: /* glsl */ `
      attribute float phase; attribute float scale;
      uniform float time;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTwinkle = 0.55 + 0.45 * sin(time * 1.5 + phase);
        gl_PointSize = scale * (320.0 / max(-mv.z, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.04, d);
        gl_FragColor = vec4(color, a * vTwinkle);
      }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.userData.timeUniform = mat.uniforms.time
  return points
}

/** Additive glow sprite used for motes, nebulae and beams. */
export function glowSprite(color: string, size: number, opacity = 0.8): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  sprite.scale.setScalar(size)
  return sprite
}

export function signTexture(label: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(20,10,40,0.35)'
  ctx.beginPath()
  ctx.roundRect(12, 18, 488, 100, 34)
  ctx.fill()
  ctx.fillStyle = color
  ctx.strokeStyle = '#241a3f'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.roundRect(8, 8, 488, 100, 34)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#241a3f'
  ctx.font = '800 56px Nunito, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 256, 60)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Soft mottled ground texture drawn once, so the surface is not a single flat colour. */
export function groundTexture(base: string, blotches: string[], speckles: string[], seed: number): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const random = rng(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 90; i += 1) {
    const x = random() * size
    const y = random() * size
    const r = 12 + random() * 70
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const color = blotches[Math.floor(random() * blotches.length)]
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 260; i += 1) {
    ctx.fillStyle = speckles[Math.floor(random() * speckles.length)]
    const r = 0.6 + random() * 1.8
    ctx.beginPath()
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function addMaze(scene: THREE.Scene, physics: Physics, maze: MazeLayout, wallColor: string, trimColor: string): void {
  const rows = maze.grid.length
  const columns = maze.grid[0]!.length
  const height = 2.6
  const thickness = .28
  const wallMaterial = flat(new THREE.Color(wallColor))
  const trimMaterial = flat(new THREE.Color(trimColor))
  const open = (row: number, column: number) => maze.grid[row]?.[column] === '.'
  const addWall = (x: number, z: number, horizontal: boolean) => {
    const size = horizontal
      ? new THREE.Vector3(maze.cellSize + .06, height, thickness)
      : new THREE.Vector3(thickness, height, maze.cellSize + .06)
    const center = new THREE.Vector3(x, height / 2, z)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), wallMaterial)
    wall.position.copy(center); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall)
    const capSize = horizontal
      ? new THREE.Vector3(maze.cellSize + .1, .12, thickness + .04)
      : new THREE.Vector3(thickness + .04, .12, maze.cellSize + .1)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(capSize.x, capSize.y, capSize.z), trimMaterial)
    cap.position.set(x, height - .06, z); cap.castShadow = true; scene.add(cap)
    physics.addStaticBox(center, size)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!open(row, column)) continue
      const x = maze.center.x + (column - (columns - 1) / 2) * maze.cellSize
      const z = maze.center.z + (row - (rows - 1) / 2) * maze.cellSize
      if (!open(row - 1, column) && !(row === 0 && open(row, column))) addWall(x, z - maze.cellSize / 2, true)
      if (!open(row + 1, column) && !(row === rows - 1 && open(row, column))) addWall(x, z + maze.cellSize / 2, true)
      if (!open(row, column - 1)) addWall(x - maze.cellSize / 2, z, false)
      if (!open(row, column + 1)) addWall(x + maze.cellSize / 2, z, false)
    }
  }
}

export function insideMaze(maze: MazeLayout, x: number, z: number, padding = 0): boolean {
  return Math.abs(x - maze.center.x) < maze.grid[0]!.length * maze.cellSize / 2 + padding
    && Math.abs(z - maze.center.z) < maze.grid.length * maze.cellSize / 2 + padding
}
