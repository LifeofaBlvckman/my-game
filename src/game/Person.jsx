import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { makeFaceTexture, faceStyle } from './faces'
import { FACE, personParts } from './people'
import { toonRamp } from './materials'

// A single character built from plain meshes: the player and named NPCs.
// The ref exposes `animate(swing)` to move the arms and legs.
const Person = forwardRef(function Person({ look, shirtMap, faceOverride, ...props }, ref) {
  const parts = useMemo(() => personParts(look), [look])
  const face = useMemo(() => makeFaceTexture(faceOverride ?? faceStyle(look.face)), [look, faceOverride])
  const limbs = useRef({})

  useImperativeHandle(ref, () => ({
    animate(swing, armSwing = swing) {
      const l = limbs.current
      if (l.legL) l.legL.rotation.x = swing
      if (l.legR) l.legR.rotation.x = -swing
      if (l.armL) l.armL.rotation.x = -armSwing * 0.8
      if (l.armR) l.armR.rotation.x = armSwing * 0.8
    },
  }))

  return (
    <group scale={look.height} {...props}>
      {parts.map((p, i) =>
        p.size[0] === 0 ? null : (
          <group key={i} position={p.pivot} ref={p.swing ? (el) => (limbs.current[p.swing] = el) : undefined}>
            <mesh position={p.offset}>
              <boxGeometry args={p.size} />
              <meshToonMaterial gradientMap={toonRamp} color={p.color} map={i === 2 && shirtMap ? shirtMap : null} />
            </mesh>
          </group>
        ),
      )}
      <mesh position={FACE.pos}>
        <planeGeometry args={FACE.size} />
        <meshToonMaterial gradientMap={toonRamp} map={face} />
      </mesh>
    </group>
  )
})

export default Person
