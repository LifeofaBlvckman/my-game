import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { makeFaceTexture, faceStyle } from './faces'
import { FACE, NECK, personParts } from './people'
import { SHAPES } from './shapes'
import { toonRamp } from './materials'

const SPLAY = { armL: 0.12, armR: -0.12 }

function Part({ p, material, origin }) {
  return (
    <mesh geometry={SHAPES[p.shape]} position={[p.offset[0] + origin[0], p.offset[1] + origin[1], p.offset[2] + origin[2]]} scale={p.size}>
      {material}
    </mesh>
  )
}

// A single character built from meshes: the player and named NPCs.
// The ref exposes `animate(pose)`; poses come from computePose in people.js.
const Person = forwardRef(function Person({ look, shirtMap, faceOverride, ...props }, ref) {
  const parts = useMemo(() => personParts(look), [look])
  const face = useMemo(() => makeFaceTexture(faceOverride ?? faceStyle(look.face)), [look, faceOverride])
  const root = useRef()
  const head = useRef()
  const limbs = useRef({})

  useImperativeHandle(ref, () => ({
    animate(p) {
      const r = root.current
      if (!r) return
      r.position.y = p.bob
      r.rotation.set(p.lean, p.twist, 0)
      r.scale.set(p.sxz, p.sy, p.sxz)
      head.current.rotation.set(p.headNod, 0, p.headTilt)
      const l = limbs.current
      if (l.legL) l.legL.rotation.x = p.legL
      if (l.legR) l.legR.rotation.x = p.legR
      if (l.armL) l.armL.rotation.x = p.armL
      if (l.armR) l.armR.rotation.x = p.armR
    },
  }))

  const mat = (p, i) => <meshToonMaterial gradientMap={toonRamp} color={p.color} map={i === 2 && shirtMap ? shirtMap : null} />

  return (
    <group scale={look.height} {...props}>
      <group ref={root}>
        {parts.map((p, i) => {
          if (p.group === 'head') return null
          if (p.group.startsWith('leg') || p.group.startsWith('arm')) {
            return (
              <group key={i} position={p.pivot} rotation-z={SPLAY[p.group] ?? 0}>
                <group ref={(el) => (limbs.current[p.group] = el)}>
                  <Part p={p} origin={[0, 0, 0]} material={mat(p, i)} />
                </group>
              </group>
            )
          }
          return <Part key={i} p={p} origin={p.pivot} material={mat(p, i)} />
        })}
        <group ref={head} position={NECK}>
          {parts.map((p, i) => (p.group === 'head' ? <Part key={i} p={p} origin={[0, 0, 0]} material={mat(p, i)} /> : null))}
          <mesh position={FACE.offset}>
            <planeGeometry args={FACE.size} />
            <meshToonMaterial gradientMap={toonRamp} map={face} transparent alphaTest={0.05} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
})

export default Person
