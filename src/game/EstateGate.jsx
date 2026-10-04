import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { city, ROAD } from './cityData'
import { toon, unlit } from './materials'
import { useGame, world } from './state'

// The boom barrier across the Banana Island causeway. It's a wall to anyone
// who doesn't live there (streetlife.js has the guards); for a resident it
// swings up as they arrive.

const HALF = ROAD / 2 + 0.6
const white = toon({ color: '#f4f1e8' })
const red = toon({ color: '#d12b2b' })
const post = toon({ color: '#3d4a5c' })
const lamp = unlit({ color: '#ffb02e' })

export default function EstateGate() {
  const g = city.bananaIsland?.gate
  // Residents, and anyone who has settled the guards.
  const resident = useGame((s) => s.properties.includes('mansion') || (s.estatePass ?? 0) > Date.now())
  const arm = useRef()
  useFrame((_, dt) => {
    if (!arm.current) return
    const want = world.gateOpen ? -1.45 : 0
    const a = arm.current.rotation.x
    arm.current.rotation.x = a + Math.sign(want - a) * Math.min(Math.abs(want - a), dt * 1.6)
  })
  if (!g) return null
  return (
    <group position={[g.x, 0, g.z]}>
      {/* Motor housing on the gatehouse side, a rest post on the other */}
      <mesh position={[0, 0.55, -HALF - 0.3]} material={post} castShadow>
        <boxGeometry args={[0.7, 1.1, 0.7]} />
      </mesh>
      <mesh position={[0, 1.18, -HALF - 0.3]} material={lamp}>
        <sphereGeometry args={[0.13, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.45, HALF + 0.1]} material={post}>
        <boxGeometry args={[0.25, 0.9, 0.25]} />
      </mesh>
      {/* The boom, hinged at the motor; red and white stripes */}
      <group ref={arm} position={[0, 0.95, -HALF - 0.3]}>
        {Array.from({ length: 8 }, (_, k) => (
          <mesh key={k} position={[0, 0, 0.4 + (k + 0.5) * ((2 * HALF + 0.2) / 8)]} material={k % 2 ? red : white} castShadow>
            <boxGeometry args={[0.14, 0.14, (2 * HALF + 0.2) / 8]} />
          </mesh>
        ))}
      </group>
      {!resident && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.3, 1.6, HALF]} position={[0, 1.6, 0]} />
        </RigidBody>
      )}
    </group>
  )
}
