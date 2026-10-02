import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color } from 'three'
import { nightUniform } from './materials'
import { useGame, world } from './state'

// Sky and fog colors through the day. Daytime Lagos gets a dusty harmattan haze.
const KEYS = [
  [0, '#141a2e'],
  [5, '#1a2036'],
  [6.5, '#e3a77a'],
  [8, '#e8d2ad'],
  [16, '#e8cfa6'],
  [18, '#e08b55'],
  [19.3, '#3a2a40'],
  [20.5, '#161c33'],
  [24, '#141a2e'],
]
const keyColors = KEYS.map(([h, c]) => [h, new Color(c)])
const skyDay = new Color('#ffe6c7')
const skyNight = new Color('#6a7cb8')
const groundDay = new Color('#6e5b45')
const groundNight = new Color('#3a3040')
const sunDay = new Color('#fff1d6')
const sunDusk = new Color('#ff9a50')
const moon = new Color('#8a9ad0')

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function daylightAt(hour) {
  return smoothstep(5.5, 7.2, hour) * (1 - smoothstep(18, 19.6, hour))
}

export default function DayNight() {
  const { scene } = useThree()
  const hemi = useRef()
  const sun = useRef()
  const color = useRef(new Color())

  useFrame((_, dt) => {
    if (useGame.getState().phase === 'playing') world.time = (world.time + Math.min(dt, 0.1)) % 1440
    const hour = world.time / 60
    const day = daylightAt(hour)
    nightUniform.value = 1 - day

    for (let k = 0; k < keyColors.length - 1; k++) {
      const [h0, c0] = keyColors[k]
      const [h1, c1] = keyColors[k + 1]
      if (hour >= h0 && hour <= h1) {
        color.current.lerpColors(c0, c1, (hour - h0) / (h1 - h0))
        break
      }
    }
    scene.background = color.current
    if (scene.fog) scene.fog.color.copy(color.current)

    hemi.current.intensity = 1.0 + 0.7 * day
    hemi.current.color.lerpColors(skyNight, skyDay, day)
    hemi.current.groundColor.lerpColors(groundNight, groundDay, day)

    // Sun arcs east to west and turns orange near the horizon.
    const angle = ((hour - 6) / 12) * Math.PI
    sun.current.position.set(Math.cos(angle) * 150, Math.max(10, Math.sin(angle) * 150), 60)
    sun.current.intensity = 0.25 + 1.75 * day
    const height = Math.max(0, Math.sin(angle))
    sun.current.color.lerpColors(sunDusk, sunDay, Math.min(1, height * 2.5))
    // After dark the same light stands in for the moon.
    sun.current.color.lerp(moon, 1 - day)
  })

  return (
    <>
      <fog attach="fog" args={['#e8cfa6', 60, 260]} />
      <hemisphereLight ref={hemi} args={['#ffe6c7', '#6e5b45', 1.6]} />
      <directionalLight ref={sun} position={[80, 120, 40]} intensity={1.8} />
    </>
  )
}
