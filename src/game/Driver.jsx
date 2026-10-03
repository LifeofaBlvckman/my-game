import { useMemo } from 'react'
import { driverFace, driverParts, seatMatrix } from './drivers'
import { faceStyle, makeFaceTexture } from './faces'
import { SHAPES } from './shapes'
import { toonRamp } from './materials'

// A driver made of meshes, for the player's car and other players' cars.
export default function Driver({ look, seat, faceOverride }) {
  const parts = useMemo(() => driverParts(look), [look])
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
