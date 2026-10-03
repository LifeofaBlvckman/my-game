import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, SphereGeometry } from 'three'
import { nightUniform } from './materials'
import { useGame, world } from './state'

// Sky colors through the day: [hour, zenith, horizon]. Daytime Lagos gets a
// warm, hazy horizon under a clear blue sky.
const KEYS = [
  [0, '#0e1530', '#2a2f55'],
  [5, '#141c3c', '#3a3560'],
  [6.5, '#6f8fc8', '#ffb38a'],
  [8, '#7ec4ea', '#f6e2bf'],
  [16, '#78bce6', '#f3dcb4'],
  [18, '#5a6fb0', '#ff9a6a'],
  [19.3, '#2c2d63', '#a85a6a'],
  [20.5, '#121a3a', '#2e3260'],
  [24, '#0e1530', '#2a2f55'],
].map(([h, z, o]) => [h, new Color(z), new Color(o)])

const skyDay = new Color('#fff4e0')
const skyNight = new Color('#7c8ad0')
const groundDay = new Color('#8a6fa8') // purple-tinted shadows
const groundNight = new Color('#2e2850')
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

const skyGeometry = new SphereGeometry(280, 24, 12)

function createSkyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { zenith: { value: new Color() }, horizon: { value: new Color() } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55);
        gl_FragColor = vec4(mix(horizon, zenith, t), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

export default function DayNight() {
  const hemi = useRef()
  const sun = useRef()
  const sky = useRef()
  const fog = useRef()
  const skyMaterial = useMemo(createSkyMaterial, [])

  useFrame(({ camera }, dt) => {
    if (useGame.getState().phase === 'playing') world.time = (world.time + Math.min(dt, 0.1)) % 1440
    const hour = world.time / 60
    const day = daylightAt(hour)
    nightUniform.value = 1 - day

    const { zenith, horizon } = skyMaterial.uniforms
    for (let k = 0; k < KEYS.length - 1; k++) {
      const [h0, z0, o0] = KEYS[k]
      const [h1, z1, o1] = KEYS[k + 1]
      if (hour >= h0 && hour <= h1) {
        const t = (hour - h0) / (h1 - h0)
        zenith.value.lerpColors(z0, z1, t)
        horizon.value.lerpColors(o0, o1, t)
        break
      }
    }
    fog.current.color.copy(horizon.value)
    sky.current.position.copy(camera.position)

    hemi.current.intensity = 1.0 + 0.8 * day
    hemi.current.color.lerpColors(skyNight, skyDay, day)
    hemi.current.groundColor.lerpColors(groundNight, groundDay, day)

    // Sun arcs east to west and turns orange near the horizon.
    const angle = ((hour - 6) / 12) * Math.PI
    sun.current.position.set(Math.cos(angle) * 150, Math.max(10, Math.sin(angle) * 150), 60)
    sun.current.intensity = 0.25 + 1.6 * day
    const height = Math.max(0, Math.sin(angle))
    sun.current.color.lerpColors(sunDusk, sunDay, Math.min(1, height * 2.5))
    // After dark the same light stands in for the moon.
    sun.current.color.lerp(moon, 1 - day)
  })

  return (
    <>
      <fog ref={fog} attach="fog" args={['#f3dcb4', 70, 270]} />
      <mesh ref={sky} geometry={skyGeometry} material={skyMaterial} renderOrder={-10} frustumCulled={false} />
      <hemisphereLight ref={hemi} args={['#fff4e0', '#8a6fa8', 1.8]} />
      <directionalLight ref={sun} position={[80, 120, 40]} intensity={1.8} />
    </>
  )
}
