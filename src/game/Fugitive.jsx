import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { Body, Wheel } from './Car'
import { Blob } from './Shadows'
import { SKIDO_LOOK } from './crowd'
import { fugitive } from './pursuit'
import { fx } from './particles'
import { toonRamp } from './materials'
import { VEHICLES } from './vehicleTypes'

// The car you're chasing in a mission (Skido's black jeep). Solid, so you
// can ram it; after the crash it sits smoking until the job moves on.
const q = new Quaternion()
const up = new Vector3(0, 1, 0)

export default function Fugitive() {
  const body = useRef()
  const [shown, setShown] = useState(null) // the vehicle type while a chase is on
  const smoke = useRef(0)
  const spin = useRef(0)
  useFrame((_, rawDt) => {
    const want = fugitive.active ? fugitive.type : null
    if (want !== shown) setShown(want)
    if (!want || !body.current) return
    const dt = Math.min(rawDt, 0.1)
    const def = VEHICLES[want]
    q.setFromAxisAngle(up, fugitive.yaw)
    body.current.setNextKinematicTranslation({ x: fugitive.x, y: def.half[1], z: fugitive.z })
    body.current.setNextKinematicRotation(q)
    spin.current += (fugitive.speed ?? 0) * dt
    if (fugitive.crashed && (smoke.current -= dt) <= 0) {
      smoke.current = 0.25
      fx.smoke(fugitive.x + Math.sin(fugitive.yaw) * 1.8, 1.3, fugitive.z + Math.cos(fugitive.yaw) * 1.8, true, 0.7)
    }
  })
  if (!shown) return null
  const def = VEHICLES[shown]
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[fugitive.x, def.half[1], fugitive.z]}>
      <CuboidCollider args={def.half} />
      <Body type={shown} color={fugitive.color} driver={fugitive.crashed ? null : SKIDO_LOOK} />
      {def.wheels.at.map((w, i) => (
        <Wheel key={i} r={def.wheels.r} position={w} />
      ))}
      <Blob position-y={-def.half[1] + 0.03} scale={[def.half[0] * 2.6, 1, def.half[2] * 2.4]} />
    </RigidBody>
  )
}
