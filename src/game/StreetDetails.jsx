import { useMemo } from 'react'
import { BoxGeometry, CanvasTexture, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, SRGBColorSpace } from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { city, ROAD, SIDEWALK_Y } from './cityData'
import { Instances, groundQuad } from './Instances'
import { toon } from './materials'

// Flower beds, stop signs and their stop lines (cityData's addStreetDetails).

const roundBed = new CylinderGeometry(0.5, 0.5, 1, 18).translate(0, 0.5, 0)
const flowerHead = new IcosahedronGeometry(0.11, 0)
const leafClump = new IcosahedronGeometry(0.17, 0)
const signPole = new BoxGeometry(0.09, 2.2, 0.09).translate(0, 1.1, 0)
const signFace = new PlaneGeometry(0.8, 0.8).translate(0, 2.35, 0.065)
// The metal plate behind the face (what you see from the back).
const signPlate = new CylinderGeometry(0.4, 0.4, 0.04, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8).translate(0, 2.35, 0.04)

function stopTexture() {
  const S = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')
  const octagon = (r, color) => {
    ctx.beginPath()
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4
      ctx.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  octagon(S * 0.5, '#ffffff')
  octagon(S * 0.44, '#c8202a')
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${S * 0.27}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('STOP', S / 2, S / 2 + 2)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const concrete = toon({ color: '#b8b4aa' })
const steel = toon({ color: '#2f5f8a' })
const pillar = toon({ color: '#8f8b82' })

// A raised footbridge across an x road (see cityData's addFootbridges): the
// deck, a ramp down to each pavement (running towards -x), railings and
// pillars. The deck, ramps and deck railings are solid so you can walk across.
function Footbridge({ f }) {
  const { x, z, height: H, ramp: L } = f
  const half = ROAD / 2 + 1.9 // deck reaches over both pavements
  const gap = Math.abs(f.sideZ[0] - z) - 0.8 // railing between the two ramp tops
  const rise = H - SIDEWALK_Y
  const slope = Math.atan2(rise, L)
  const run = Math.hypot(L, rise)
  const box = (key, pos, size, mat, rot = [0, 0, 0]) => (
    <mesh key={key} position={pos} rotation={rot} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  )
  const parts = [
    box('deck', [x, H - 0.15, z], [1.8, 0.3, half * 2], concrete),
    // Open railings: a top rail and a middle rail on posts. The -x side stops
    // where the ramps come up; the deck ends are railed across.
    ...[
      ['A', x - 0.88, gap],
      ['B', x + 0.88, half],
    ].flatMap(([id, rx, len]) => [
      box(`top${id}`, [rx, H + 1.0, z], [0.08, 0.08, len * 2], steel),
      box(`mid${id}`, [rx, H + 0.5, z], [0.05, 0.05, len * 2], steel),
      ...Array.from({ length: Math.floor(len / 1.5) * 2 + 1 }, (_, k) => box(`post${id}${k}`, [rx, H + 0.5, z - Math.floor(len / 1.5) * 1.5 + k * 1.5], [0.07, 1.0, 0.07], steel)),
    ]),
    // A light roof over the deck, on four posts.
    box('roof', [x, H + 2.55, z], [2.3, 0.08, half * 2 + 0.4], steel),
    ...[-1, 1].flatMap((e) => [-1, 1].map((sd) => box(`rpole${e}${sd}`, [x + sd * 0.92, H + 1.8, z + e * (half - 0.2)], [0.08, 1.5, 0.08], steel))),
    ...[-1, 1].flatMap((e) => [
      box(`endTop${e}`, [x, H + 1.0, z + e * (half - 0.03)], [1.8, 0.08, 0.08], steel),
      box(`endMid${e}`, [x, H + 0.5, z + e * (half - 0.03)], [1.8, 0.05, 0.05], steel),
    ]),
  ]
  for (const [k, sz] of f.sideZ.entries()) {
    const mid = [x - 0.9 - L / 2, SIDEWALK_Y + rise / 2 - 0.12, sz]
    // A flight of stairs: treads, with a sloping concrete stringer underneath
    // and a handrail on the open side (the slope underneath is what you
    // actually walk on; Player.jsx keeps your feet on the steps).
    const STEPS = 22
    for (let n = 0; n < STEPS; n++) {
      const sx = x - 0.9 - L + (L / STEPS) * (n + 0.5)
      const top = SIDEWALK_Y + (rise / STEPS) * (n + 1)
      parts.push(box(`step${k}-${n}`, [sx, top - 0.09, sz], [L / STEPS + 0.02, 0.18, 1.5], concrete))
    }
    parts.push(box(`stringer${k}`, [mid[0], mid[1] - 0.25, sz], [run, 0.3, 1.4], pillar, [0, 0, slope]))
    const outer = sz + Math.sign(sz - z) * 0.72
    parts.push(box(`rrail${k}`, [mid[0], mid[1] + 0.95, outer], [run, 0.07, 0.07], steel, [0, 0, slope]))
    for (let n = 1; n < 6; n++) {
      const px = x - 0.9 - L + (L / 6) * n
      const py = SIDEWALK_Y + (rise / 6) * n
      parts.push(box(`rpost${k}-${n}`, [px, py + 0.45, outer], [0.06, 0.9, 0.06], steel))
    }
    parts.push(box(`pillar${k}`, [x, (H - 0.3) / 2, sz], [0.5, H - 0.3, 0.5], pillar))
    parts.push(box(`rpillar${k}`, [x - 0.9 - L * 0.45, (rise * 0.55) / 2, sz], [0.35, rise * 0.55, 0.35], pillar))
  }
  return (
    <group>
      {parts}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.15, half]} position={[x, H - 0.15, z]} />
        <CuboidCollider args={[0.05, 0.6, gap]} position={[x - 0.92, H + 0.5, z]} />
        <CuboidCollider args={[0.9, 0.6, 0.05]} position={[x, H + 0.5, z - half]} />
        <CuboidCollider args={[0.9, 0.6, 0.05]} position={[x, H + 0.5, z + half]} />
        <CuboidCollider args={[0.05, 0.6, half]} position={[x + 0.92, H + 0.5, z]} />
        {f.sideZ.map((sz, k) => (
          <CuboidCollider key={k} args={[run / 2, 0.12, 0.75]} position={[x - 0.9 - L / 2, SIDEWALK_Y + rise / 2 - 0.12, sz]} rotation={[0, 0, slope]} />
        ))}
      </RigidBody>
    </group>
  )
}

export default function StreetDetails() {
  const signMaterial = useMemo(() => toon({ map: stopTexture(), alphaTest: 0.5 }), [])
  const boxBeds = useMemo(() => city.flowerBeds.filter((b) => !b.round), [])
  const roundBeds = useMemo(() => city.flowerBeds.filter((b) => b.round), [])
  return (
    <group>
      {city.footbridges.map((f, i) => (
        <Footbridge key={i} f={f} />
      ))}
      {/* Beds: a brick kerb with dark soil inside */}
      <Instances
        items={boxBeds}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w + 0.3, 0.22, b.d + 0.3)
        }}
        colors={() => '#b5583c'}
      />
      <Instances
        items={boxBeds}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w, 0.25, b.d)
        }}
        colors={() => '#4b3220'}
      />
      <Instances
        items={roundBeds}
        geometry={roundBed}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w + 0.4, 0.22, b.d + 0.4)
        }}
        colors={() => '#d8d2c4'}
      />
      <Instances
        items={roundBeds}
        geometry={roundBed}
        castShadow={false}
        transform={(o, b) => {
          o.position.set(b.x, b.y, b.z)
          o.scale.set(b.w, 0.26, b.d)
        }}
        colors={() => '#4b3220'}
      />
      {/* Flowers: a clump of leaves with a bloom on top */}
      <Instances
        items={city.flowers}
        geometry={leafClump}
        castShadow={false}
        transform={(o, f, i) => {
          o.position.set(f.x, f.y + 0.08, f.z)
          o.rotation.set(i, i * 1.7, 0)
          o.scale.set(f.s * 1.1, f.s * 0.8, f.s * 1.1)
        }}
        colors={(_, i) => (i % 3 ? '#3f8a3a' : '#4f9c40')}
      />
      <Instances
        items={city.flowers}
        geometry={flowerHead}
        castShadow={false}
        transform={(o, f, i) => {
          o.position.set(f.x, f.y + 0.2 + (i % 4) * 0.03, f.z)
          o.rotation.set(i * 0.7, i, 0)
          o.scale.setScalar(f.s)
        }}
        colors={(f) => f.color}
      />
      {/* Stop signs and lines */}
      <Instances items={city.stopSigns} geometry={signPole} transform={(o, g) => o.position.set(g.x, 0, g.z)} colors={() => '#8d9196'} />
      <Instances
        items={city.stopSigns}
        geometry={signPlate}
        transform={(o, g) => {
          o.position.set(g.x, 0, g.z)
          o.rotation.y = g.yaw
        }}
        colors={() => '#8d9196'}
      />
      <Instances
        items={city.stopSigns}
        geometry={signFace}
        material={signMaterial}
        transform={(o, g) => {
          o.position.set(g.x, 0, g.z)
          o.rotation.y = g.yaw
        }}
      />
      <Instances
        items={city.stopLines}
        geometry={groundQuad}
        castShadow={false}
        transform={(o, l) => {
          o.position.set(l.x, 0.016, l.z)
          o.scale.set(l.along === 'x' ? l.len : 0.4, 1, l.along === 'x' ? 0.4 : l.len)
        }}
        colors={() => '#eeeeea'}
      />
    </group>
  )
}
