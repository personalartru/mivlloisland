import * as THREE from 'three'
import type { Physics } from '../../engine/physics'
import type { LevelLayout } from '../layout'
import { createClockworkState, speedMultiplierAt, updateClockworkState, type ClockworkState } from '../clockwork'
import { flat, glowSprite, gradientSky, groundTexture, rng } from './shared'

export class ClockworkWorld {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn: THREE.Vector3
  private readonly gears: THREE.Mesh[] = []
  private readonly plates: THREE.Mesh[] = []
  private readonly pads: THREE.Mesh[] = []
  private readonly lamps: THREE.PointLight[] = []
  private readonly smoke: THREE.Sprite[] = []
  private readonly state: ClockworkState
  private readonly motor: THREE.Group
  private time = 0
  constructor(private readonly physics: Physics, shadowMapSize: number, private readonly layout: LevelLayout) {
    this.spawn = layout.spawn.clone(); this.state = createClockworkState(layout.clockwork!.plates.length)
    const random = rng(layout.seed)
    this.scene.background = new THREE.Color('#16101d'); this.scene.fog = new THREE.Fog('#251b35', 55, 170)
    this.scene.add(gradientSky({ top: '#100c1b', middle: '#2a1b36', horizon: '#7e4b52', sunDir: new THREE.Vector3(-.5,.7,-.4), sunColor: '#ffd08a', sunStrength: .7 }))
    this.scene.add(new THREE.HemisphereLight('#d8c4ff', '#261a2d', 1.15))
    this.sun = new THREE.DirectionalLight('#ffe1b0', 2.1); this.sun.castShadow = true; this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize); this.scene.add(this.sun, this.sun.target)
    this.addGround(random); this.motor = this.addMotor(); this.addPlates(); this.addSpeedPads(); this.addPipes(random); this.addBoundary(random); this.addSkyGears(random)
  }
  update(dt: number, focus: THREE.Vector3): void {
    this.time += dt; this.sun.position.set(focus.x + 25, focus.y + 42, focus.z + 18); this.sun.target.position.copy(focus)
    for (const [i, gear] of this.gears.entries()) gear.rotation.y += dt * (i % 2 ? -.6 : .6) * (this.state.machineActive ? 2.2 : .35)
    this.motor.rotation.y += dt * (this.state.machineActive ? 1.5 : .08)
    for (const [i, lamp] of this.lamps.entries()) lamp.intensity = this.state.active[i] ? 1.5 + Math.sin(this.time * 3 + i) * .2 : 0.05
    for (const [i, smoke] of this.smoke.entries()) { smoke.position.y += dt * .45; (smoke.material as THREE.SpriteMaterial).opacity = .18 + Math.sin(this.time * 1.6 + i) * .08; if (smoke.position.y > 5) smoke.position.y = 1 }
  }
  setLanterns(done: number): void { for (let i=0;i<this.lamps.length;i++) this.lamps[i].intensity = i < done ? 1.5 : .05 }
  resetMechanics(): void { this.state.active.fill(false); this.state.machineActive = false }
  updateMechanics(position: THREE.Vector3): void {
    const next = updateClockworkState(this.state, position, this.layout.clockwork!)
    this.state.active = next.active; this.state.machineActive = next.machineActive
    for (const [i, plate] of this.plates.entries()) { const on = this.state.active[i]; (plate.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.2 : .18; (plate.material as THREE.MeshStandardMaterial).color.set(on ? '#f2b35c' : '#5a4052') }
  }
  movementMultiplierAt(position: THREE.Vector3): number { return speedMultiplierAt(position, this.layout.clockwork!) }
  get machineActive(): boolean { return this.state.machineActive }
  private addGround(random:()=>number): void { const r=this.layout.radius; const tex=groundTexture('#49323b',['#2d2430','#67464b','#382b38'],['rgba(255,190,110,.35)','rgba(100,240,220,.25)'],this.layout.seed); tex.repeat.set(4,4); const top=new THREE.Mesh(new THREE.CircleGeometry(r,96),new THREE.MeshStandardMaterial({map:tex,roughness:.86,metalness:.18})); top.rotation.x=-Math.PI/2; top.position.y=.02; top.receiveShadow=true; const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.9,8,72),flat(new THREE.Color('#2d202b'))); body.position.y=-4; this.scene.add(top,body); this.physics.addStaticCylinder(new THREE.Vector3(0,-4,0),r,8); for(let i=0;i<20;i++){const a=random()*Math.PI*2,d=4+random()*23;const rivet=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.04,8),flat(new THREE.Color('#e1a35b')));rivet.position.set(Math.cos(a)*d,.07,Math.sin(a)*d);this.scene.add(rivet)} }
  private addMotor(): THREE.Group { const at=this.layout.landmark; const g=new THREE.Group();g.position.copy(at);const base=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.8,.5,16),flat(new THREE.Color('#55333b')));base.position.y=.25;g.add(base);for(let i=0;i<4;i++){const gear=new THREE.Mesh(new THREE.TorusGeometry(1.4+i*.35,.18,8,16),new THREE.MeshStandardMaterial({color:i%2?'#e1a35b':'#6fd8c8',metalness:.7,roughness:.25}));gear.rotation.x=Math.PI/2;gear.position.y=.7+i*.35;g.add(gear);this.gears.push(gear)}const chimney=new THREE.Mesh(new THREE.CylinderGeometry(.7,.9,5,10),flat(new THREE.Color('#6f4b4a')));chimney.position.y=2.7;g.add(chimney);const glow=glowSprite('#ffd27a',1.3,1);glow.position.y=5.3;g.add(glow);this.scene.add(g);this.physics.addStaticCylinder(new THREE.Vector3(at.x,2,at.z),2.4,4);return g }
  private addPlates(): void { for(const [i,at] of this.layout.clockwork!.plates.entries()){const p=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.35,.12,12),new THREE.MeshStandardMaterial({color:'#5a4052',emissive:'#f2b35c',emissiveIntensity:.18,metalness:.65,roughness:.3}));p.position.set(at.x,.1,at.z);this.scene.add(p);this.plates.push(p);const l=new THREE.PointLight('#ffd27a',.05,5);l.position.set(at.x,1,at.z);this.scene.add(l);this.lamps.push(l);this.physics.addStaticCylinder(new THREE.Vector3(at.x,.5,at.z),1.3,.7);void i} }
  private addSpeedPads(): void { for(const pad of this.layout.clockwork!.speedPads){const m=new THREE.Mesh(new THREE.RingGeometry(pad.radius*.55,pad.radius,6),new THREE.MeshBasicMaterial({color:'#62ead5',transparent:true,opacity:.8,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(pad.center.x,.08,pad.center.z);this.scene.add(m);this.pads.push(m)} }
  private addPipes(random:()=>number): void { for(let i=0;i<11;i++){const g=new THREE.Group();const x=-23+random()*46;const z=-22+random()*44;const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,2+random()*4,8),flat(new THREE.Color('#78c9bf')));pipe.position.y=1+pipe.geometry.parameters.height/2;g.add(pipe);const cap=new THREE.Mesh(new THREE.SphereGeometry(.27,8,6),flat(new THREE.Color('#e1a35b')));cap.position.y=pipe.position.y+pipe.geometry.parameters.height/2;g.add(cap);this.scene.add(g);const s=glowSprite('#d9fff7',.38,.16);s.position.set(x,1.2,z);this.scene.add(s);this.smoke.push(s)} }
  private addBoundary(random:()=>number): void {const n=64,r=this.layout.playableRadius+1;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r;this.physics.addStaticBox(new THREE.Vector3(x,2.5,z),new THREE.Vector3(.6,5,3.5),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-a));if(i%2===0){const gear=new THREE.Mesh(new THREE.TorusGeometry(1+random(),.16,6,12),flat(new THREE.Color('#8b5550')));gear.position.set(x,1,z);gear.rotation.x=Math.PI/2;this.scene.add(gear)}}}
  private addSkyGears(random:()=>number): void {for(let i=0;i<8;i++){const gear=new THREE.Mesh(new THREE.TorusGeometry(3+random()*3,.22,8,24),new THREE.MeshBasicMaterial({color:i%2?'#e1a35b':'#75d8ca',transparent:true,opacity:.25,depthWrite:false}));gear.position.set(-60+random()*120,18+random()*35,-55+random()*80);gear.rotation.set(random(),random(),random());this.scene.add(gear);this.gears.push(gear)}}
}
