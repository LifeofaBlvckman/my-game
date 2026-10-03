import { useMemo } from 'react'
import { driverFace, driverParts, seatMatrix } from './drivers'
import { faceStyle, makeFaceTexture } from './faces'
import { SHAPES } from './shapes'
import { toonRamp } from './materials'

// A seated person made of meshes (driver or passenger), for the player's car
// and other players' cars.
export default function Driver({ look, seat, faceOverride, driving = true }) {
  const parts = useMemo(() => driverParts(look, driving), [look, driving])
  const seatM = useMemo(() => seatMatrix(seat), [seat])
  const face = useMemo(() => makeFaceTexture(faceOverride ?? faceStyle(look.face)), [look, faceOverride])
  return (
    <group matrix={seatM} matrixAutoUpdate={false}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={SHAPES[p.shape]} matrix={p.m} matrixAutoUpdate={false}>
          <meshToonMaterial gradientMap={toonRamp} color={p.color} />
        </mesh>
      ))}
      <mesh matrix={driverFace} matrixAutoUpdate={false}>
        <planeGeometry args={[1, 1]} />
        <meshToonMaterial gradientMap={toonRamp} map={face} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}
