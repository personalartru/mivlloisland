import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { ItemKind, QuestId } from './quests'

export type PropKey = 'tree' | 'cottage'

/** Every runtime GLB, preloaded once at boot and shared by the scene. */
export type ModelPack = {
  player: GLTF
  npcs: Record<QuestId, GLTF>
  items: Record<ItemKind, GLTF>
  props: Record<PropKey, GLTF>
}

type InstanceOptions = {
  /** World-space height the model is normalised to. */
  height: number
  /** Skinned characters must be cloned with SkeletonUtils. */
  skeleton?: boolean
}

/**
 * Clone a GLB scene, scale it to a friendly height, put its feet on y=0 and centre it on x/z.
 * The returned holder is the object gameplay positions; the visual never drifts on its own.
 * glTF models face +Z; callers rotate the holder for their own facing convention.
 */
export function instantiate(gltf: GLTF, { height, skeleton = false }: InstanceOptions): THREE.Group {
  const source = skeleton ? skeletonClone(gltf.scene) : gltf.scene.clone(true)
  const holder = new THREE.Group()
  holder.add(source)

  source.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(source)
  const size = box.getSize(new THREE.Vector3())
  const scale = height / Math.max(size.y, 1e-4)
  source.scale.setScalar(scale)
  source.updateMatrixWorld(true)

  const scaled = new THREE.Box3().setFromObject(source)
  const center = scaled.getCenter(new THREE.Vector3())
  source.position.x -= center.x
  source.position.z -= center.z
  source.position.y -= scaled.min.y

  source.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      // Keep generated props matte: bright cartoon scenes should not glare under the sun.
      material.metalness = Math.min(material.metalness, 0.05)
      material.roughness = Math.max(material.roughness, 0.55)
      material.envMapIntensity = 0.35
      if (material.emissiveIntensity > 1.5) material.emissiveIntensity = 1.5
    }
  })
  return holder
}

export function findClip(gltf: GLTF, pattern: RegExp): THREE.AnimationClip | undefined {
  return gltf.animations.find(clip => pattern.test(clip.name))
}
