import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape } from 'three'
import { city } from './cityData'
import { toon, unlit } from './materials'
import { WATER_Y } from './Water'

// Yachts tied up at the Banana Island marina, bobbing on the swell.

// Hull outline seen from above: pointed bow (+z), square stern.
const hullShape = new Shape()
hullShape.moveTo(-1.8, -6)
hullShape.lineTo(1.8, -6)
hullShape.lineTo(1.9, 2)
hullShape.quadraticCurveTo(1.6, 5, 0, 7)
hullShape.quadraticCurveTo(-1.6, 5, -1.9, 2)
hullShape.closePath()
const hull = new ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 2 }).rotateX(-Math.PI / 2)
const deckShape = new Shape()
deckShape.moveTo(-1.5, -5.6)
deckShape.lineTo(1.5, -5.6)
deckShape.lineTo(1.5, 1.5)
deckShape.quadraticCurveTo(1.2, 4.2, 0, 5.8)
deckShape.quadraticCurveTo(-1.2, 4.2, -1.5, 1.5)
deckShape.closePath()
const deck = new ExtrudeGeometry(deckShape, { depth: 0.1, bevelEnabled: false }).rotateX(-Math.PI / 2)

const teak = toon({ color: '#b5835a' })
const navy = toon({ color: '#1b2a52' })
const chrome = toon({ color: '#d8dde2' })
const glass = unlit({ color: '#24323f' })

function Yacht({ y: spot }) {
  const ref = useRef()
  const paint = useMemo(() => toon({ color: spot.color }), [spot.color])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + spot.x
    const g = ref.current
    if (!g) return
    g.position.y = WATER_Y - 0.9 + Math.sin(t * 1.1) * 0.12
    g.rotation.z = Math.sin(t * 0.9) * 0.03
    g.rotation.x = Math.sin(t * 0.7) * 0.02
  })
  return (
    <group position={[spot.x, 0, spot.z]} rotation-y={spot.yaw}>
      <group ref={ref}>
        <mesh geometry={hull} material={paint} castShadow />
        <mesh geometry={deck} material={teak} position-y={2.45} />
        {/* Navy boot stripe along the waterline */}
        <mesh position={[0, 0.6, 0]} material={navy}>
          <boxGeometry args={[3.9, 0.25, 11.8]} />
        </mesh>
        {/* Cabin with wraparound windows, a flybridge on top */}
        <mesh position={[0, 3.3, -1]} material={paint} castShadow>
          <boxGeometry args={[2.6, 1.6, 6]} />
        </mesh>
        <mesh position={[0, 3.4, -1]} material={glass}>
          <boxGeometry args={[2.64, 0.6, 5.6]} />
        </mesh>
        <mesh position={[0, 4.25, -1.6]} material={paint}>
          <boxGeometry args={[2.4, 0.3, 4]} />
        </mesh>
        <mesh position={[0, 4.9, -2.4]} material={chrome}>
          <boxGeometry args={[0.08, 1.3, 0.08]} />
        </mesh>
        {/* Rails */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.45, 3.0, 0]} material={chrome}>
            <boxGeometry args={[0.05, 0.05, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Yachts() {
  return (city.yachts ?? []).map((y, i) => <Yacht key={i} y={y} />)
}
