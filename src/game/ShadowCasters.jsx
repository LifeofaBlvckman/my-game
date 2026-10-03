import { useFrame, useThree } from '@react-three/fiber'

// Opts every toon-shaded mesh into casting and receiving shadows. Meshes come
// and go (remote players, vehicle swaps), so this re-checks every second.
// Set `userData.noShadow` on a mesh to leave it out entirely, or
// `userData.noCast` for things that only receive shadows (flat markings).
export default function ShadowCasters() {
  const { scene } = useThree()
  let timer = 1
  useFrame((_, dt) => {
    timer += dt
    if (timer < 1) return
    timer = 0
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.shadowChecked) return
      o.userData.shadowChecked = true
      if (o.userData.noShadow || !o.material?.isMeshToonMaterial || o.material.transparent) return
      o.castShadow = !o.userData.noCast
      o.receiveShadow = true
    })
  })
  return null
}
