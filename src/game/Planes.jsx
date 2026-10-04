import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Matrix4, Shape, SphereGeometry, SRGBColorSpace, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { city } from './cityData'
import { toon, unlit } from './materials'
import { world } from './state'

// Airliners: parked at both airports' stands, one taking off and landing at
// Murtala Muhammed over and over, and the one you fly in (flights.js).
// Built from simple shapes merged into a few meshes (one per paint colour),
// in Eko Air's livery: white, a green belly, a gold cheatline, the green tail.

const Y = 3.1 // fuselage centre height with the gear down
const R = 1.95 // fuselage radius

// --- Geometry, built once ---
const m4 = new Matrix4()
const place = (g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) => {
  g.applyMatrix4(m4.makeScale(sx, sy, sz))
  if (rx) g.applyMatrix4(m4.makeRotationX(rx))
  if (ry) g.applyMatrix4(m4.makeRotationY(ry))
  if (rz) g.applyMatrix4(m4.makeRotationZ(rz))
  g.applyMatrix4(m4.makeTranslation(x, y, z))
  return g
}
// A flat tapered panel (wing, tailplane), from its outline in (span, chord).
function panel(points, thickness) {
  const s = new Shape()
  points.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)))
  s.closePath()
  return new ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false })
}
// Wing for one side (sign = +1 right, -1 left): swept back, tapered, a bit of dihedral.
function wing(sign) {
  const pts = [
    [1.6, 2.6],
    [14.6, -4.1],
    [14.6, -5.7],
    [1.6, -3.6],
  ].map(([a, b]) => [a * sign, b])
  if (sign < 0) pts.reverse()
  return place(panel(pts, 0.34), { rx: Math.PI / 2, rz: sign * 0.06, y: Y - 0.95 + 0.17 })
}
function tailplane(sign) {
  const pts = [
    [0.8, -12.1],
    [6.6, -15.2],
    [6.6, -16.5],
    [0.8, -15.6],
  ].map(([a, b]) => [a * sign, b])
  if (sign < 0) pts.reverse()
  return place(panel(pts, 0.22), { rx: Math.PI / 2, rz: sign * 0.1, y: Y + 0.75 })
}
function winglet(sign) {
  const g = panel(
    [
      [-4.1, 0],
      [-5.7, 0],
      [-6.3, 2.0],
      [-5.6, 2.0],
    ],
    0.12,
  )
  return place(g, { ry: -Math.PI / 2, x: sign * 14.6 - 0.06, y: Y - 0.95 + 0.16 + 0.8 })
}
const fin = place(
  panel(
    [
      [-11.6, 1.5],
      [-16.2, 1.5],
      [-17.3, 7.8],
      [-15.4, 7.8],
    ],
    0.32,
  ),
  { ry: -Math.PI / 2, x: 0.16, y: Y },
)

// The back of the tail cone rises towards the APU, like the real thing.
function sweepUp(g) {
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    if (z < -11) p.setY(i, p.getY(i) + (-11 - z) * 0.12)
  }
  g.computeVertexNormals()
  return g
}

const half = Math.PI / 2
const parts = {
  white: [
    place(new CylinderGeometry(R, R, 24, 28, 1, true), { rx: half, y: Y, z: 1 }),
    place(new SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, half), { rx: half, sy: 1.7, z: 13, y: Y }),
    // The tail cone sweeps up to the APU.
    sweepUp(place(new CylinderGeometry(0.35, R, 6.6, 28, 1, true), { rx: -half, z: -14.3, y: Y })),
    place(new SphereGeometry(2.05, 20, 10), { sx: 1.05, sy: 0.55, sz: 3.4, y: Y - 1.45, z: -0.6 }), // wing-root fairing
    wing(1),
    wing(-1),
    tailplane(1),
    tailplane(-1),
    ...[-1, 1].map((s) => place(new BoxGeometry(0.28, 0.85, 2.8), { x: s * 5.3, y: Y - 1.0, z: 1.2 })), // engine pylons
  ],
  green: [
    // Belly, under the cheatline.
    place(new CylinderGeometry(R + 0.015, R + 0.015, 23.6, 28, 1, true, -1.05, 2.1), { rx: half, y: Y, z: 1.1 }),
    fin,
    winglet(1),
    winglet(-1),
    ...[-1, 1].map((s) => place(new CylinderGeometry(0.98, 0.82, 3.9, 22, 1, true), { rx: half, x: s * 5.3, y: Y - 1.85, z: 2.3 })), // nacelles
  ],
  gold: [
    // Cheatline down both sides.
    ...[-1, 1].map((s) => place(new CylinderGeometry(R + 0.025, R + 0.025, 23.4, 28, 1, true, s > 0 ? 1.3 : -1.42, 0.12), { rx: half, y: Y, z: 1.2 })),
    place(new BoxGeometry(0.34, 0.22, 4.4), { y: Y + 7.6, z: -16.2 }), // fin cap
  ],
  grey: [
    ...[-1, 1].map((s) => place(new TorusGeometry(0.9, 0.11, 8, 22), { x: s * 5.3, y: Y - 1.85, z: 4.25 })), // intake lips
    ...[-1, 1].map((s) => place(new ConeGeometry(0.55, 1.3, 16, 1, true), { rx: -half, x: s * 5.3, y: Y - 1.85, z: -0.3 })), // exhausts
    ...[-1, 1].map((s) => place(new ConeGeometry(0.26, 0.55, 12), { rx: half, x: s * 5.3, y: Y - 1.85, z: 4.15 })), // spinners
    // Door outlines, front and back, both sides.
    ...[-1, 1].flatMap((s) => [10.4, -8.6].map((z) => place(new BoxGeometry(0.02, 1.9, 0.95), { x: s * (R + 0.03), y: Y + 0.15, z }))),
  ],
  dark: [
    // Cockpit windscreen: a band round the top of the nose.
    place(new SphereGeometry(R + 0.02, 28, 6, Math.PI * 1.5 - 0.95, 1.9, 0.92, 0.36), { rx: half, sy: 1.7, z: 13, y: Y }),
    // Cabin windows, both sides.
    ...[-1, 1].flatMap((s) => Array.from({ length: 26 }, (_, k) => place(new BoxGeometry(0.06, 0.34, 0.24), { x: s * 1.9, y: Y + 0.5, z: -8.9 + k * 0.8 }))),
    ...[-1, 1].map((s) => place(new CircleGeometry(0.82, 22), { x: s * 5.3, y: Y - 1.85, z: 4.18 })), // fan faces
    place(new CircleGeometry(0.33, 12), { ry: Math.PI, y: Y + 0.8, z: -17.62 }), // APU exhaust
  ],
}
const merged = Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, mergeGeometries(list.map((g) => g.toNonIndexed()), false)]))

// Landing gear: nose leg with twin wheels, two main legs with four-wheel bogies.
const tyre = new CylinderGeometry(1, 1, 1, 16).rotateZ(half)
const gearParts = {
  grey: mergeGeometries(
    [
      place(new CylinderGeometry(0.12, 0.12, 1.9, 8), { y: 1.35, z: 11.4 }),
      ...[-1, 1].flatMap((s) => [
        place(new CylinderGeometry(0.2, 0.2, 2.1, 8), { x: s * 2.7, y: 1.45, z: -1.4 }),
        place(new BoxGeometry(0.24, 0.22, 2.2), { x: s * 2.7, y: 0.6, z: -1.4 }), // bogie beam
        place(new BoxGeometry(0.06, 1.3, 1.6), { x: s * 3.1, y: 1.7, z: -1.4 }), // gear door
      ]),
    ].map((g) => g.toNonIndexed()),
  ),
  dark: mergeGeometries(
    [
      ...[-1, 1].map((s) => place(tyre.clone(), { sx: 0.26, sy: 0.44, sz: 0.44, x: s * 0.22, y: 0.44, z: 11.4 })),
      ...[-1, 1].flatMap((s) => [-1, 1].flatMap((a) => [-1, 1].map((w) => place(tyre.clone(), { sx: 0.3, sy: 0.56, sz: 0.56, x: s * 2.7 + w * 0.33, y: 0.56, z: -1.4 + a * 0.72 })))),
    ].map((g) => g.toNonIndexed()),
  ),
}

// Titles and the tail logo, painted on canvases.
function paint(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}
const titles = paint(512, 96, (ctx, w, h) => {
  ctx.font = 'italic bold 72px Arial Black, Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1f8a4a'
  ctx.fillText('EKO AIR', w / 2, h / 2)
})
const logo = paint(128, 128, (ctx, w) => {
  ctx.fillStyle = '#e0b43a'
  ctx.beginPath()
  ctx.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1f8a4a'
  ctx.font = 'bold 88px Arial Black, Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('E', w / 2, w / 2 + 4)
})

const mats = {
  white: toon({ color: '#f4f5f2' }),
  green: toon({ color: '#1f8a4a', side: DoubleSide }),
  gold: toon({ color: '#e0b43a', side: DoubleSide }),
  grey: toon({ color: '#9aa1a8', side: DoubleSide }),
  dark: toon({ color: '#22303d', side: DoubleSide }),
}
mats.white.side = DoubleSide
const titleMat = unlit({ map: titles, transparent: true, depthWrite: false })
const logoMat = unlit({ map: logo, transparent: true })
const navRed = unlit({ color: '#ff2a2a' })
const navGreen = unlit({ color: '#3fff6a' })
const strobe = unlit({ color: '#ffffff' })
const strobeOff = unlit({ color: '#9aa1a8' })
const beacon = unlit({ color: '#ff3b30' })
const beaconOff = unlit({ color: '#5a1a1a' })
const titlePlane = new BoxGeometry(5.2, 1, 0.01)
const logoPlane = new CircleGeometry(1.15, 24)
const bulb = new SphereGeometry(0.14, 8, 6)

// Nose points +z, wheels on the ground at y = 0 (with the gear down).
export const Airliner = forwardRef(function Airliner({ gear = true, lights = true, ...props }, ref) {
  const strobes = useRef([])
  const beacons = useRef([])
  useFrame(({ clock }) => {
    if (!lights) return
    const t = clock.elapsedTime
    const flash = t % 1.2 < 0.08
    const pulse = t % 1 < 0.5
    for (const m of strobes.current) if (m) m.material = flash ? strobe : strobeOff
    for (const m of beacons.current) if (m) m.material = pulse ? beacon : beaconOff
  })
  return (
    <group ref={ref} {...props}>
      {Object.keys(merged).map((k) => (
        <mesh key={k} geometry={merged[k]} material={mats[k]} castShadow />
      ))}
      {gear && Object.keys(gearParts).map((k) => <mesh key={k} geometry={gearParts[k]} material={mats[k]} castShadow />)}
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Titles above the windows, leaning in with the curve of the fuselage */}
          <group position={[s * 1.66, Y + 1.0, 4.5]} rotation-z={-s * 0.55}>
            <mesh geometry={titlePlane} material={titleMat} rotation-y={s * half} scale-y={0.75} />
          </group>
          <mesh geometry={logoPlane} material={logoMat} position={[s * 0.18, Y + 4.4, -15]} rotation-y={s * half} />
        </group>
      ))}
      {/* Navigation lights: red on the left wingtip, green on the right,
          white strobes on the tips and the tail, red beacons top and bottom */}
      <mesh geometry={bulb} material={navRed} position={[-14.75, Y - 0.05, -4.9]} />
      <mesh geometry={bulb} material={navGreen} position={[14.75, Y - 0.05, -4.9]} />
      {[
        [-14.75, Y - 0.05, -5.6],
        [14.75, Y - 0.05, -5.6],
        [0, Y + 0.85, -17.7],
      ].map((p, i) => (
        <mesh key={i} ref={(m) => (strobes.current[i] = m)} geometry={bulb} material={strobeOff} position={p} />
      ))}
      {[
        [0, Y + R + 0.05, 2],
        [0, Y - R - 0.3, 4],
      ].map((p, i) => (
        <mesh key={i} ref={(m) => (beacons.current[i] = m)} geometry={bulb} material={beaconOff} position={p} />
      ))}
    </group>
  )
})

// One take-off and one landing at Murtala Muhammed, alternating. t runs 0..CYCLE seconds.
const CYCLE = 90
function ambientFlight(t, runway) {
  const { x0, x1, z } = runway
  if (t < 40) {
    // Take-off to the east: roll, rotate, climb out over the lagoon.
    const s = Math.max(0, t - 4)
    const x = x0 + 8 + 0.5 * 2.6 * s * s
    const lift = Math.max(0, x - (x0 + 70))
    const y = Math.min(260, lift * 0.2 + lift * lift * 0.0008)
    return { x, y, z, pitch: Math.min(0.22, lift * 0.004), visible: x < 1400, gear: y < 40 }
  }
  // Landing from the west: a long glide down onto the runway, then braking.
  const s = t - 40
  const touch = x0 + 14
  const approach = 22 // s to come down
  if (s < approach) {
    const k = 1 - s / approach
    return { x: touch - k * 600, y: k * 95, z, pitch: -0.06 + 0.12 * (1 - k), visible: true, gear: k < 0.6 }
  }
  const r = s - approach
  const v = Math.max(0, 40 - r * 6) // brake from 40 m/s
  const dist = Math.min((40 * 40) / 12, 40 * r - 3 * r * r)
  return { x: Math.min(x1 - 20, touch + dist), y: 0, z, pitch: 0, visible: r < 18 && v >= 0, gear: true }
}

function FlyingPlane() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const a = city.airport
    const g = ref.current
    if (!a || !g) return
    const f = ambientFlight(clock.elapsedTime % CYCLE, a.runway)
    // (Out of the way while you're on a flight of your own.)
    g.visible = f.visible && !world.flight
    g.position.set(f.x, f.y, f.z)
    g.rotation.set(-f.pitch, Math.PI / 2, 0, 'YXZ')
  })
  return <Airliner ref={ref} />
}

// The plane you're on.
function YourFlight() {
  const ref = useRef()
  const gearUp = useRef()
  const gearDown = useRef()
  useFrame(() => {
    const g = ref.current
    const f = world.flight
    if (!g) return
    g.visible = !!f
    if (!f?.pose) return
    const p = f.pose
    g.position.set(p.x, p.y, p.z)
    g.rotation.set(-p.pitch, p.yaw, p.roll, 'YXZ')
    const down = p.y < 45
    gearDown.current.visible = down
    gearUp.current.visible = !down
  })
  return (
    <group ref={ref} visible={false}>
      <group ref={gearDown}>
        <Airliner />
      </group>
      <group ref={gearUp} visible={false}>
        <Airliner gear={false} />
      </group>
    </group>
  )
}

function Stands({ airport }) {
  return airport.stands.map((p, i) => (
    <RigidBody key={i} type="fixed" colliders={false} position={[p.x, 0.12, p.z]} rotation-y={p.yaw}>
      <Airliner lights={false} />
      <CuboidCollider args={[2, 2, 15]} position={[0, Y, -1]} />
      <CuboidCollider args={[13, 0.4, 2.6]} position={[0, Y - 0.8, -1.5]} />
      <CuboidCollider args={[0.25, 3.2, 2.4]} position={[0, Y + 4.2, -15.4]} />
    </RigidBody>
  ))
}

export default function Planes() {
  const airports = useMemo(() => [city.airport, city.ekoAirport].filter(Boolean), [])
  if (!airports.length) return null
  return (
    <group>
      {airports.map((a, i) => (
        <Stands key={i} airport={a} />
      ))}
      {city.airport && <FlyingPlane />}
      <YourFlight />
    </group>
  )
}
