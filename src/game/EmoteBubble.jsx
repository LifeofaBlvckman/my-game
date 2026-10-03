import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { EMOTE_TIME, emoteTexture } from './emotes'

// The bubble over someone's head. `get()` returns { e, at } or nothing.
export default function EmoteBubble({ get, y = 2.15 }) {
  const mesh = useRef()
  const shown = useRef(-1)
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const em = get()
    const age = em ? (performance.now() - em.at) / 1000 : Infinity
    if (age > EMOTE_TIME) {
      m.visible = false
      return
    }
    if (shown.current !== em.e || !m.visible) {
      m.material.map = emoteTexture(em.e)
      m.material.needsUpdate = true
      shown.current = em.e
    }
    m.visible = true
    // Pop in with a little overshoot, bob, then shrink away.
    const pop = age < 0.25 ? 1.25 * Math.sin((age / 0.25) * Math.PI * 0.6) / Math.sin(Math.PI * 0.6) : 1
    const out = age > EMOTE_TIME - 0.25 ? (EMOTE_TIME - age) / 0.25 : 1
    m.scale.setScalar(0.75 * Math.min(pop, 1.25) * out)
    m.position.y = Math.sin(age * 4) * 0.04
  })
  return (
    <Billboard position-y={y}>
      <mesh ref={mesh} visible={false} renderOrder={10}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}
