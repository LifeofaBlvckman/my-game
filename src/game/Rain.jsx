import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, LineBasicMaterial } from 'three'
import { useGame } from './state'
import { weather } from './weather'

// Rain streaks in a box that follows the camera. Each drop is a short line
// that falls, slanted a little by the wind, and starts again at the top.

const PHONE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const DROPS = PHONE ? 900 : 2000
const BOX = 28 // m across
const HEIGHT = 26
const FALL = 24 // m/s
const LENGTH = 1.3
const WIND = 0.18 // sideways drift per metre fallen

export default function Rain() {
  const lines = useRef()
  const drops = useMemo(() => Array.from({ length: DROPS }, () => ({ x: (Math.random() - 0.5) * BOX, y: Math.random() * HEIGHT, z: (Math.random() - 0.5) * BOX, v: FALL * (0.85 + Math.random() * 0.3) })), [])
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(DROPS * 6), 3))
    return g
  }, [])
  const material = useMemo(() => new LineBasicMaterial({ color: '#d6dee6', transparent: true, opacity: 0, depthWrite: false, fog: false }), [])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const show = weather.rain > 0.01 && !useGame.getState().inside
    lines.current.visible = show
    if (!show) return
    material.opacity = 0.7 * Math.min(1, weather.rain * 1.4)
    // Lighter rain: fewer drops drawn.
    const count = Math.floor(DROPS * Math.min(1, 0.25 + weather.rain))
    geometry.setDrawRange(0, count * 2)
    const pos = geometry.attributes.position.array
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z
    for (let i = 0; i < count; i++) {
      const d = drops[i]
      d.y -= d.v * dt
      if (d.y < -4) {
        d.y += HEIGHT
        d.x = (Math.random() - 0.5) * BOX
        d.z = (Math.random() - 0.5) * BOX
      }
      const x = cx + d.x + d.y * WIND
      const y = cy - 6 + d.y
      const z = cz + d.z
      const k = i * 6
      pos[k] = x
      pos[k + 1] = y
      pos[k + 2] = z
      pos[k + 3] = x - LENGTH * WIND
      pos[k + 4] = y - LENGTH
      pos[k + 5] = z
    }
    geometry.attributes.position.needsUpdate = true
  })

  return <lineSegments ref={lines} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} userData={{ noShadow: true }} />
}
