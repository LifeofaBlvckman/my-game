import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, ConeGeometry, DoubleSide, IcosahedronGeometry, Matrix4, Quaternion, ShaderMaterial, SphereGeometry, UniformsLib, UniformsUtils, Vector3 } from 'three'
import { ISLAND, MAINLAND, mulberry32, onBanana } from './cityData'
import { nightUniform, toon } from './materials'
import { world } from './state'

// The lagoon and the sea: clear water you can see into, a sandy seabed with
// light rippling across it, rocks and seaweed, and schools of fish.

export const WATER_Y = -1.4
export const SEABED_Y = -5

// Water, as far as fish are concerned: the lagoon between the two
// landmasses, and the open sea beyond the beaches (past the shelf).
let WORLD = null
export function setWaterBounds(bounds) {
  WORLD = bounds
}
const SHELF = 30 // how far the beach slopes out under the water
export function isWater(x, z, margin = 0) {
  if (!WORLD) return false
  if (onBanana(x, z, 2 + margin)) return false
  if (x > MAINLAND.maxX + 2 + margin && x < ISLAND.minX - 2 - margin && z > WORLD.minZ - 200 && z < WORLD.maxZ + 200) return true
  return x < WORLD.minX - SHELF - margin || x > WORLD.maxX + SHELF + margin || z < WORLD.minZ - SHELF - margin || z > WORLD.maxZ + SHELF + margin
}

const surfaceMaterial = new ShaderMaterial({
  transparent: true,
  fog: true,
  uniforms: UniformsUtils.merge([
    UniformsLib.fog,
    {
      uShallow: { value: new Color('#86e3dc') },
      uDeep: { value: new Color('#2d8fa6') },
      uFoam: { value: new Color('#f4fbf8') },
      uTime: { value: 0 },
      uNight: { value: 0 },
    },
  ]),
  vertexShader: /* glsl */ `
    #include <fog_pars_vertex>
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uShallow, uDeep, uFoam;
    uniform float uTime, uNight;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      // Clear when you look down into it, more solid toward the horizon.
      vec3 view = normalize(cameraPosition - vWorld);
      float down = clamp(view.y, 0.0, 1.0);
      float alpha = mix(0.93, 0.32, pow(down, 0.55));
      vec3 col = mix(uDeep, uShallow, down);
      // Short hand-drawn wave strokes drifting across the surface.
      vec2 p = vWorld.xz * vec2(0.09, 0.22);
      float wave = sin(p.x * 3.0 + sin(p.y * 1.7 + uTime * 0.5) * 1.6 + uTime * 0.35);
      float dash = step(0.55, hash(floor(vec2(p.x * 0.8, p.y * 2.0))));
      float stroke = smoothstep(0.965, 0.995, wave) * dash;
      col = mix(col, uFoam, stroke * 0.7);
      alpha = max(alpha, stroke * 0.85);
      col *= mix(1.0, 0.32, uNight);
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
})

// Seabed: wet sand with bright, shifting caustic lines, tinted by the water above.
const seabedMaterial = new ShaderMaterial({
  fog: true,
  uniforms: UniformsUtils.merge([
    UniformsLib.fog,
    { uSand: { value: new Color('#e3c98c') }, uTint: { value: new Color('#3aa3b4') }, uTime: { value: 0 }, uNight: { value: 0 } },
  ]),
  vertexShader: /* glsl */ `
    #include <fog_pars_vertex>
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uSand, uTint;
    uniform float uTime, uNight;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    void main() {
      vec2 p = vWorld.xz * 0.3;
      float c = sin(p.x * 2.1 + uTime * 0.8 + sin(p.y * 1.7 + uTime * 0.5) * 1.2)
              + sin(p.y * 2.3 - uTime * 0.7 + sin(p.x * 1.9 - uTime * 0.4) * 1.3);
      // Thin, bright ripples of light, and darker sand in the troughs.
      float caustic = smoothstep(1.62, 1.86, c) - smoothstep(1.86, 1.98, c) * 0.5;
      float ripple = sin(vWorld.x * 0.9 + sin(vWorld.z * 0.35) * 2.0) * 0.5 + 0.5;
      vec3 col = mix(uSand, uTint, 0.22) * (0.9 + ripple * 0.1) + caustic * 0.18;
      col *= mix(1.0, 0.3, uNight);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
})

// A fish: a flattened body and a tail fin, about 0.6 m long, facing +z.
const fishBody = new SphereGeometry(0.5, 7, 5).scale(0.2, 0.3, 0.6)
const fishTail = new BufferGeometry()
fishTail.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, -0.26, 0, 0.16, -0.48, 0, -0.16, -0.48]), 3))
fishTail.computeVertexNormals()
const FISH_COLORS = ['#ff9a3c', '#ffd23a', '#c8d6e0', '#4fb3ff', '#ff6f6f', '#9ae66e']
const SCHOOLS = 22
const PER_SCHOOL = 7
const FISH = SCHOOLS * PER_SCHOOL

const ROCKS = 900
const WEEDS = 1800
const rockGeometry = new IcosahedronGeometry(0.5, 0)
const weedGeometry = new ConeGeometry(0.35, 1, 5).translate(0, 0.5, 0)
const fishMaterial = toon()
const fishTailMaterial = toon({ side: DoubleSide })
const decorMaterial = toon()

const m = new Matrix4()
const m2 = new Matrix4()
const q = new Quaternion()
const pos = new Vector3()
const scale = new Vector3()
const up = new Vector3(0, 1, 0)
const zero = new Matrix4().makeScale(0, 0, 0)
const color = new Color()

export default function Water({ bounds }) {
  setWaterBounds(bounds)
  const bodies = useRef()
  const tails = useRef()

  // Rocks and seaweed scattered over the lagoon floor and the shallows.
  const decor = useMemo(() => {
    const rand = mulberry32(404)
    const rocks = []
    const weeds = []
    let tries = 0
    while ((rocks.length < ROCKS || weeds.length < WEEDS) && tries++ < 40000) {
      const lagoon = rand() < 0.6
      const x = lagoon ? MAINLAND.maxX + rand() * (ISLAND.minX - MAINLAND.maxX) : bounds.minX - 120 + rand() * (bounds.maxX - bounds.minX + 240)
      const z = lagoon ? bounds.minZ - 100 + rand() * (bounds.maxZ - bounds.minZ + 200) : bounds.minZ - 120 + rand() * (bounds.maxZ - bounds.minZ + 240)
      if (!isWater(x, z, 1)) continue
      if (rocks.length < ROCKS && rand() < 0.4) rocks.push({ x, z, s: 0.6 + rand() * 1.8, r: rand() * 6 })
      else if (weeds.length < WEEDS) weeds.push({ x, z, s: 0.6 + rand() * 1.4, r: rand() * 6, c: rand() < 0.5 ? '#3f9a5a' : '#5fae4e' })
    }
    return { rocks, weeds }
  }, [bounds])

  const schools = useMemo(() => {
    const rand = mulberry32(99)
    return Array.from({ length: SCHOOLS }, (_, i) => ({
      active: false,
      x: 0,
      z: 0,
      y: -3,
      heading: rand() * Math.PI * 2,
      speed: 1 + rand() * 1.2,
      color: FISH_COLORS[i % FISH_COLORS.length],
      size: 0.7 + rand() * 0.6,
      fish: Array.from({ length: PER_SCHOOL }, () => ({ ox: (rand() - 0.5) * 3, oz: (rand() - 0.5) * 3, oy: (rand() - 0.5) * 0.8, phase: rand() * 10 })),
    }))
  }, [])

  const rand = useMemo(() => mulberry32(7), [])
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    surfaceMaterial.uniforms.uTime.value = seabedMaterial.uniforms.uTime.value = t
    surfaceMaterial.uniforms.uNight.value = seabedMaterial.uniforms.uNight.value = nightUniform.value * 0.85
    const f = world.focus
    let colored = false
    schools.forEach((s, si) => {
      // Schools live near the player; far-off ones move to new water nearby.
      if (!s.active || Math.hypot(s.x - f.x, s.z - f.z) > 100) {
        s.active = false
        for (let k = 0; k < 12 && !s.active; k++) {
          const a = rand() * Math.PI * 2
          const r = 8 + rand() * 60
          const x = f.x + Math.cos(a) * r
          const z = f.z + Math.sin(a) * r
          if (isWater(x, z, 4)) Object.assign(s, { active: true, x, z, y: -2.1 - rand() * 1.8 })
        }
      }
      if (s.active) {
        // Wander, and turn back before reaching the shore.
        s.heading += Math.sin(t * 0.3 + si) * dt * 0.4
        const nx = s.x + Math.sin(s.heading) * s.speed * dt
        const nz = s.z + Math.cos(s.heading) * s.speed * dt
        if (isWater(nx + Math.sin(s.heading) * 4, nz + Math.cos(s.heading) * 4, 2)) {
          s.x = nx
          s.z = nz
        } else s.heading += Math.PI * (0.6 + rand() * 0.4)
      }
      s.fish.forEach((fish, k) => {
        const i = si * PER_SCHOOL + k
        if (!s.active) {
          bodies.current.setMatrixAt(i, zero)
          tails.current.setMatrixAt(i, zero)
          return
        }
        const wiggle = Math.sin(t * 9 + fish.phase) * 0.25
        q.setFromAxisAngle(up, s.heading + wiggle * 0.3)
        pos.set(s.x + fish.ox + Math.sin(t * 0.7 + fish.phase) * 0.4, s.y + fish.oy + Math.sin(t * 1.3 + fish.phase) * 0.15, s.z + fish.oz)
        m.compose(pos, q, scale.setScalar(s.size))
        bodies.current.setMatrixAt(i, m)
        tails.current.setMatrixAt(i, m2.multiplyMatrices(m, m2.makeRotationY(wiggle * 2)))
        if (!s.colorSet) {
          bodies.current.setColorAt(i, color.set(s.color))
          tails.current.setColorAt(i, color.set(s.color).multiplyScalar(0.8))
          colored = true
        }
      })
      if (s.active) s.colorSet = true
    })
    bodies.current.instanceMatrix.needsUpdate = tails.current.instanceMatrix.needsUpdate = true
    if (colored) {
      bodies.current.instanceColor.needsUpdate = true
      tails.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_Y} material={surfaceMaterial} renderOrder={1} userData={{ noShadow: true }}>
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={SEABED_Y} material={seabedMaterial} userData={{ noShadow: true }}>
        <planeGeometry args={[4000, 4000]} />
      </mesh>
      <instancedMesh
        args={[rockGeometry, decorMaterial, decor.rocks.length]}
        ref={(mesh) => {
          if (!mesh || mesh.userData.done) return
          mesh.userData.done = true
          decor.rocks.forEach((r, i) => {
            mesh.setMatrixAt(i, m.compose(pos.set(r.x, SEABED_Y + r.s * 0.25, r.z), q.setFromAxisAngle(up, r.r), scale.set(r.s * 1.3, r.s * 0.7, r.s)))
            mesh.setColorAt(i, color.set(i % 3 ? '#8a8f86' : '#6f756c'))
          })
          mesh.instanceMatrix.needsUpdate = true
        }}
        userData={{ noShadow: true }}
      />
      <instancedMesh
        args={[weedGeometry, decorMaterial, decor.weeds.length]}
        ref={(mesh) => {
          if (!mesh || mesh.userData.done) return
          mesh.userData.done = true
          decor.weeds.forEach((w, i) => {
            mesh.setMatrixAt(i, m.compose(pos.set(w.x, SEABED_Y, w.z), q.setFromAxisAngle(up, w.r), scale.set(w.s * 0.5, w.s * 1.6, w.s * 0.5)))
            mesh.setColorAt(i, color.set(w.c))
          })
          mesh.instanceMatrix.needsUpdate = true
        }}
        userData={{ noShadow: true }}
      />
      <instancedMesh ref={bodies} args={[fishBody, fishMaterial, FISH]} frustumCulled={false} userData={{ noShadow: true }} />
      <instancedMesh ref={tails} args={[fishTail, fishTailMaterial, FISH]} frustumCulled={false} userData={{ noShadow: true }} />
    </group>
  )
}
