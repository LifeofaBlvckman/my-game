import { forwardRef, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { city } from './cityData'
import { toonRamp, unlit } from './materials'

// Airliners at Murtala Muhammed: three parked at the terminal, and one that
// takes off and one that lands in turn, over and over. Built from simple
// shapes like everything else; Eko Air livery (white, green, a gold band).

const WHITE = '#f4f5f2'
const GREEN = '#1f8a4a'
const GOLD = '#e0b43a'
const GREY = '#9aa1a8'
const DARK = '#2a2f36'

function M({ color, children, ...props }) {
  return (
    <mesh {...props}>
      {children}
      <meshToonMaterial gradientMap={toonRamp} color={color} />
    </mesh>
  )
}

const windowsMat = unlit({ color: '#24323f' })
const strobeMat = unlit({ color: '#ff3b30' })

// Nose points +z. Length ~28 m, span ~26 m, wheels on the ground at y = 0.
export const Airliner = forwardRef(function Airliner({ gear = true, ...props }, ref) {
  return (
    <group ref={ref} {...props}>
      <group position-y={3}>
        {/* Fuselage, nose cone and tail cone */}
        <M color={WHITE} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1.9, 1.9, 22, 18]} />
        </M>
        <M color={WHITE} position-z={11} scale={[1, 1, 1.9]}>
          <sphereGeometry args={[1.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </M>
        <M color={WHITE} position={[0, 0.5, -13.5]} rotation-x={-Math.PI / 2} scale={[1, 1, 0.8]}>
          <coneGeometry args={[1.9, 5.5, 18]} />
        </M>
        {/* Cockpit windows and the row of cabin windows */}
        <mesh position={[0, 0.75, 12.9]} rotation-x={-0.5} material={windowsMat}>
          <boxGeometry args={[1.9, 0.45, 0.6]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.88, 0.45, 0.5]} material={windowsMat}>
            <boxGeometry args={[0.05, 0.32, 18]} />
          </mesh>
        ))}
        {/* Livery: green belly band and a gold pinstripe */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <M color={GREEN} position={[s * 1.86, -0.55, 0]}>
              <boxGeometry args={[0.08, 0.7, 21]} />
            </M>
            <M color={GOLD} position={[s * 1.88, -0.12, 0]}>
              <boxGeometry args={[0.06, 0.14, 21]} />
            </M>
          </group>
        ))}
        {/* Wings, swept back, with engines under them */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <M color={WHITE} position={[s * 6.8, -0.8, -0.5]} rotation-y={s * -0.38}>
              <boxGeometry args={[11.5, 0.35, 3.2]} />
            </M>
            <M color={GREEN} position={[s * 12.4, -0.25, -2.8]} rotation-y={s * -0.38}>
              <boxGeometry args={[0.25, 1.4, 1.4]} />
            </M>
            <M color={GREY} position={[s * 5.2, -1.85, 1.6]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.95, 0.85, 3.6, 14]} />
            </M>
            <M color={DARK} position={[s * 5.2, -1.85, 3.42]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.8, 0.8, 0.05, 14]} />
            </M>
            <M color={WHITE} position={[s * 3.1, 0.6, -12]} rotation-y={s * -0.35}>
              <boxGeometry args={[5, 0.25, 1.8]} />
            </M>
          </group>
        ))}
        {/* Tail fin, green with the gold "E" */}
        <M color={GREEN} position={[0, 3.4, -12]} rotation-x={-0.42}>
          <boxGeometry args={[0.3, 5.4, 3.4]} />
        </M>
        <M color={GOLD} position={[0, 3.6, -12.2]} rotation-x={-0.42}>
          <boxGeometry args={[0.34, 1.2, 1.2]} />
        </M>
        <mesh position={[0, 6, -13.3]} material={strobeMat}>
          <sphereGeometry args={[0.18, 8, 6]} />
        </mesh>
      </group>
      {gear && (
        <>
          {/* Landing gear */}
          <M color={DARK} position={[0, 0.5, 9]}>
            <cylinderGeometry args={[0.5, 0.5, 0.4, 10]} />
          </M>
          {[-1, 1].map((s) => (
            <group key={s}>
              <M color={GREY} position={[s * 2.2, 1.3, -1]}>
                <boxGeometry args={[0.25, 1.6, 0.25]} />
              </M>
              <M color={DARK} position={[s * 2.2, 0.55, -1]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.55, 0.55, 0.6, 12]} />
              </M>
            </group>
          ))}
          <M color={GREY} position={[0, 1.3, 9]}>
            <boxGeometry args={[0.2, 1.6, 0.2]} />
          </M>
        </>
      )}
    </group>
  )
})

// One take-off and one landing, alternating. t runs 0..CYCLE seconds.
const CYCLE = 90
function flight(t, runway) {
  const { x0, x1, z } = runway
  if (t < 40) {
    // Take-off to the east: roll, rotate, climb out over the lagoon.
    const s = Math.max(0, t - 4)
    const x = x0 + 8 + 0.5 * 2.6 * s * s
    const lift = Math.max(0, x - (x0 + 70))
    const y = Math.min(260, lift * 0.2 + lift * lift * 0.0008)
    return { x, y, z, pitch: Math.min(0.22, lift * 0.004), visible: x < 1400 }
  }
  // Landing from the west: a long glide down onto the runway, then braking.
  const s = t - 40
  const touch = x0 + 14
  const approach = 22 // s to come down
  if (s < approach) {
    const k = 1 - s / approach
    return { x: touch - k * 600, y: k * 95, z, pitch: -0.06 + 0.12 * (1 - k), visible: true }
  }
  const r = s - approach
  const v = Math.max(0, 40 - r * 6) // brake from 40 m/s
  const dist = Math.min((40 * 40) / 12, 40 * r - 3 * r * r)
  return { x: Math.min(x1 - 20, touch + dist), y: 0, z, pitch: 0, visible: r < 18 && v >= 0 }
}

function FlyingPlane() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const a = city.airport
    const g = ref.current
    if (!a || !g) return
    const f = flight(clock.elapsedTime % CYCLE, a.runway)
    g.visible = f.visible
    g.position.set(f.x, f.y, f.z)
    g.rotation.set(-f.pitch, Math.PI / 2, 0, 'YXZ')
  })
  return <Airliner ref={ref} />
}

export default function Planes() {
  const a = city.airport
  if (!a) return null
  return (
    <group>
      {a.stands.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[p.x, 0.12, p.z]} rotation-y={p.yaw}>
          <Airliner />
          <CuboidCollider args={[2, 2, 13]} position={[0, 3, 0]} />
          <CuboidCollider args={[12, 0.4, 2]} position={[0, 2.2, -1]} />
        </RigidBody>
      ))}
      <FlyingPlane />
    </group>
  )
}
