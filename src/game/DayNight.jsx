import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, Object3D, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { nightUniform } from './materials'
import { useGame, world } from './state'
import { weather } from './weather'

// Sky through the day: [hour, zenith, horizon, clouds]. Daytime is the flat
// teal of an illustrated sky, with lighter painted cloud shapes.
const KEYS = [
  [0, '#141d33', '#25304d', '#1e2a44'],
  [5, '#1b2440', '#3a3a5e', '#2c3454'],
  [6.5, '#6c9cb8', '#f2b896', '#f6d2bc'],
  [8, '#4fb0b4', '#9fd6cc', '#d4f0e8'],
  [16, '#4aaab0', '#a6d8cc', '#d6f1ea'],
  [18, '#5d86a8', '#f0a67a', '#f7caa8'],
  [19.3, '#2e3563', '#a4607a', '#7a5a7a'],
  [20.5, '#16203c', '#2c3458', '#222c4a'],
  [24, '#141d33', '#25304d', '#1e2a44'],
].map(([h, z, o, c]) => [h, new Color(z), new Color(o), new Color(c)])

// Light colors. The fill is flat (same from above and below) so the shadow
// tone doesn't vary with the surface angle: that's the two-tone look.
const FILL_DAY = new Color('#b3c2d8')
const FILL_NIGHT = new Color('#58658f')
const SUN_DAY = new Color('#fff0d8')
const SUN_DUSK = new Color('#ffa868')
const MOON = new Color('#9aa8dc')

const SHADOW_RANGE = 55 // meters of shadow around the player
const SHADOW_SIZE = 1024

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function daylightAt(hour) {
  return smoothstep(5.5, 7.2, hour) * (1 - smoothstep(18, 19.6, hour))
}

const skyGeometry = new SphereGeometry(580, 32, 16)

function createSkyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new Color() },
      horizon: { value: new Color() },
      cloud: { value: new Color() },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 cloud;
      uniform float time;
      varying vec3 vDir;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float up = clamp(vDir.y, 0.0, 1.0);
        vec3 color = mix(horizon, zenith, pow(up, 0.5));
        // Flat painted clouds: noise projected onto a dome, cut off sharply.
        vec2 uv = vDir.xz / (vDir.y + 0.25) * 1.4 + vec2(time * 0.004, time * 0.0015);
        float n = fbm(uv);
        float shape = smoothstep(0.56, 0.58, n) * smoothstep(0.02, 0.2, vDir.y);
        float core = smoothstep(0.64, 0.66, n) * shape;
        color = mix(color, cloud, shape * 0.9);
        color = mix(color, cloud * 1.04, core * 0.5);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

const sunDir = new Vector3()

const RAIN_ZENITH = new Color('#7f8b94')
const RAIN_HORIZON = new Color('#a3adb3')
const RAIN_CLOUD = new Color('#8e979c')

export default function DayNight() {
  const fill = useRef()
  const sun = useRef()
  const sky = useRef()
  const fog = useRef()
  const target = useMemo(() => new Object3D(), [])
  const skyMaterial = useMemo(createSkyMaterial, [])
  const shadowsOn = useGame((s) => s.shadows)

  useEffect(() => {
    const light = sun.current
    light.target = target
    const cam = light.shadow.camera
    cam.left = cam.bottom = -SHADOW_RANGE
    cam.right = cam.top = SHADOW_RANGE
    cam.near = 1
    cam.far = 400
    cam.updateProjectionMatrix()
    light.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE)
    light.shadow.bias = -0.00025
    light.shadow.radius = 0.6 // tight filtering: crisp edges (see stylize.js)
    light.shadow.normalBias = 0.04
  }, [target])

  useFrame(({ camera, clock }, dt) => {
    window.__gameRunning = true // the scene is drawing: see index.html
    if (useGame.getState().phase === 'playing') world.time = (world.time + Math.min(dt, 0.1)) % 1440
    const hour = world.time / 60
    const day = daylightAt(hour)
    nightUniform.value = 1 - day

    const { zenith, horizon, cloud, time } = skyMaterial.uniforms
    time.value = clock.elapsedTime
    for (let k = 0; k < KEYS.length - 1; k++) {
      const [h0, z0, o0, c0] = KEYS[k]
      const [h1, z1, o1, c1] = KEYS[k + 1]
      if (hour >= h0 && hour <= h1) {
        const t = (hour - h0) / (h1 - h0)
        zenith.value.lerpColors(z0, z1, t)
        horizon.value.lerpColors(o0, o1, t)
        cloud.value.lerpColors(c0, c1, t)
        break
      }
    }
    // Rain greys the sky, pulls the haze in, and dims the sun.
    const wet = weather.rain
    if (wet > 0) {
      zenith.value.lerp(RAIN_ZENITH, wet * 0.85)
      horizon.value.lerp(RAIN_HORIZON, wet * 0.85)
      cloud.value.lerp(RAIN_CLOUD, wet * 0.9)
    }
    fog.current.color.copy(horizon.value)
    fog.current.near = 260 - 200 * wet
    fog.current.far = 600 - 320 * wet
    sky.current.position.copy(camera.position)

    // Flat cool fill; its brightness sets how dark shadows are.
    fill.current.color.lerpColors(FILL_NIGHT, FILL_DAY, day)
    fill.current.groundColor.copy(fill.current.color)
    fill.current.intensity = 3.3 - 0.3 * day - 0.5 * wet + weather.flash * 5 // lightning

    // Sun arcs east to west and warms near the horizon; the moon stands in at night.
    const angle = ((hour - 6) / 12) * Math.PI
    const height = Math.max(0, Math.sin(angle))
    if (day > 0.02) sunDir.set(Math.cos(angle), Math.max(0.25, Math.sin(angle)), 0.45).normalize()
    else sunDir.set(-0.4, 0.8, 0.45).normalize()
    sun.current.color.lerpColors(SUN_DUSK, SUN_DAY, Math.min(1, height * 2.5)).lerp(MOON, 1 - day)
    sun.current.intensity = (1.05 + 0.6 * day) * (1 - 0.6 * wet)

    // Keep the shadow camera centered on the player, snapped to whole shadow
    // map texels so shadow edges don't shimmer as you move.
    const step = (SHADOW_RANGE * 2) / SHADOW_SIZE
    const fx = Math.round(world.focus.x / step) * step
    const fz = Math.round(world.focus.z / step) * step
    target.position.set(fx, 0, fz)
    target.updateMatrixWorld()
    sun.current.position.set(fx + sunDir.x * 150, sunDir.y * 150, fz + sunDir.z * 150)
  })

  return (
    <>
      <fog ref={fog} attach="fog" args={['#a6d8cc', 260, 600]} />
      <mesh ref={sky} geometry={skyGeometry} material={skyMaterial} renderOrder={-10} frustumCulled={false} />
      <hemisphereLight ref={fill} args={['#b3c2d8', '#b3c2d8', 3]} />
      <directionalLight ref={sun} intensity={1.1} castShadow={shadowsOn} />
      <primitive object={target} />
    </>
  )
}
