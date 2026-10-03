import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, CanvasTexture, Color, DoubleSide } from 'three'
import { city } from './cityData'
import { makeSignTexture } from './faces'
import { nightUniform, toon, toonRamp, unlit } from './materials'
import { Instances, groundQuad } from './Instances'

const poleGeometry = new BoxGeometry(0.08, 1, 0.08).translate(0, 0.5, 0)
const emissiveMaterial = unlit()

// White-to-black radial gradient: with additive blending the black edge adds nothing.
function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#000000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}
const glow = glowTexture()

// Market stalls and roadside umbrellas: table, goods, canopy and four poles.
function Stalls() {
  const parts = useMemo(() => {
    const tables = []
    const goods = []
    const canopies = []
    const poles = []
    city.stalls.forEach((s) => {
      const k = s.size
      const cos = Math.cos(s.rot)
      const sin = Math.sin(s.rot)
      const local = (x, z) => [s.x + x * cos + z * sin, s.z - x * sin + z * cos]
      tables.push({ s, x: s.x, z: s.z, w: 2.2 * k, d: 1.2 * k, h: 0.9 })
      s.goods.forEach((color, n) => {
        const [x, z] = local((n - 1) * 0.65 * k, 0.1)
        goods.push({ s, x, z, color, k })
      })
      canopies.push({ s, color: s.canopy })
      for (const [px, pz] of [[-1.15, -0.75], [1.15, -0.75], [-1.15, 0.75], [1.15, 0.75]]) {
        const [x, z] = local(px * k, pz * k)
        poles.push({ x, z, h: 2.3 * k })
      }
    })
    return { tables, goods, canopies, poles }
  }, [])

  return (
    <group>
      <Instances
        items={parts.tables}
        transform={(o, t) => {
          o.position.set(t.x, 0, t.z)
          o.rotation.y = t.s.rot
          o.scale.set(t.w, t.h, t.d)
        }}
        colors={() => '#6b4a2b'}
      />
      <Instances
        items={parts.goods}
        transform={(o, g) => {
          o.position.set(g.x, 0.9, g.z)
          o.rotation.y = g.s.rot
          o.scale.set(0.55 * g.k, 0.3, 0.8 * g.k)
        }}
        colors={(g) => g.color}
      />
      <Instances
        items={parts.canopies}
        transform={(o, c) => {
          o.position.set(c.s.x, 2.3 * c.s.size, c.s.z)
          o.rotation.set(0.12, c.s.rot, 0)
          o.scale.set(2.8 * c.s.size, 0.08, 2.2 * c.s.size)
        }}
        colors={(c) => c.color}
      />
      <Instances
        items={parts.poles}
        geometry={poleGeometry}
        transform={(o, p) => {
          o.position.set(p.x, 0, p.z)
          o.scale.y = p.h
        }}
        colors={() => '#3a3a3a'}
      />
    </group>
  )
}

export function Sign({ s }) {
  const texture = useMemo(() => makeSignTexture(s.text, { bg: s.bg, fg: s.fg, w: 512, h: Math.round((512 * s.h) / s.w), glow: s.glow }), [s])
  const material = useMemo(() => (s.glow ? unlit({ map: texture }) : toon({ map: texture })), [texture, s.glow])
  return (
    <group position={[s.x, s.y, s.z]} rotation-y={s.rot}>
      <mesh material={material} position-z={0.06}>
        <planeGeometry args={[s.w, s.h]} />
      </mesh>
      <mesh>
        <boxGeometry args={[s.w + 0.3, s.h + 0.3, 0.1]} />
        <meshToonMaterial gradientMap={toonRamp} color="#2a2a2a" />
      </mesh>
      {(s.posts || s.legs) &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[(side * s.w) / 2.4, -(s.posts ? s.y : 3.2) / 2 - s.h / 2, -0.1]}>
            <boxGeometry args={[0.25, s.posts ? s.y : 3.2, 0.25]} />
            <meshToonMaterial gradientMap={toonRamp} color="#3a3a3a" />
          </mesh>
        ))}
    </group>
  )
}

// Club neon: flickers a little and throws a fake pool of light onto the pavement.
function Neon({ n, index }) {
  const texture = useMemo(
    () => makeSignTexture(n.text, { bg: '#08070c', fg: n.color, w: 512, h: Math.round((512 * n.h) / n.w), glow: n.color, border: n.color }),
    [n],
  )
  const sign = useRef()
  const pool = useRef()
  const base = useMemo(() => new Color(n.color), [n.color])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index * 1.7
    const flicker = Math.sin(t * 31) > 0.97 ? 0.3 : 1
    const night = nightUniform.value
    sign.current.color.setScalar((0.55 + 0.45 * night) * flicker)
    pool.current.color.copy(base).multiplyScalar((0.25 + 0.35 * Math.sin(t * 4) ** 2) * night)
  })
  return (
    <group>
      <mesh position={[n.x, n.y, n.z]}>
        <planeGeometry args={[n.w, n.h]} />
        <meshBasicMaterial ref={sign} map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[n.x, 0.14, n.z + 3]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[10, 7]} />
        <meshBasicMaterial ref={pool} map={glow} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function MallGlass({ g }) {
  const material = useRef()
  const day = useMemo(() => new Color('#6f9bb8'), [])
  const night = useMemo(() => new Color('#ffe2a0'), [])
  useFrame(() => material.current.color.lerpColors(day, night, nightUniform.value * 0.8))
  return (
    <mesh position={[g.x, g.y + g.h / 2, g.z]}>
      <boxGeometry args={[g.w, g.h, 0.12]} />
      <meshBasicMaterial ref={material} toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}

export default function Landmarks() {
  const visible = useMemo(() => city.solids.filter((s) => !s.hidden && !s.emissive), [])
  const glowing = useMemo(() => city.solids.filter((s) => s.emissive), [])

  return (
    <group>
      <Instances
        items={visible}
        transform={(o, s) => {
          o.position.set(s.x, s.y ?? 0, s.z)
          o.scale.set(s.w, s.h, s.d)
        }}
        colors={(s) => s.color}
      />
      <Instances
        items={glowing}
        material={emissiveMaterial}
        transform={(o, s) => {
          o.position.set(s.x, s.y ?? 0, s.z)
          o.scale.set(s.w, s.h, s.d)
        }}
        colors={(s) => s.color}
      />
      <Instances
        items={city.parkingLines}
        geometry={groundQuad}
        castShadow={false}
        transform={(o, p) => {
          o.position.set(p.x, 0.135, p.z)
          o.scale.set(0.15, 1, 5)
        }}
        colors={() => '#f2f2f2'}
      />
      <Stalls />
      {city.signs.map((s, i) => (
        <Sign key={i} s={s} />
      ))}
      {city.neon.map((n, i) => (
        <Neon key={i} n={n} index={i} />
      ))}
      {city.glass.map((g, i) => (
        <MallGlass key={i} g={g} />
      ))}
    </group>
  )
}
