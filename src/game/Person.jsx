import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { makeFaceTexture, faceStyle } from './faces'
import { FACE, NECK, personParts } from './people'
import { SHAPES } from './shapes'
import { toonRamp } from './materials'

const SPLAY = { armL: 0.06, armR: -0.06 }
const isLimb = (g) => g.startsWith('leg') || g.startsWith('arm')

function Part({ p, origin, map }) {
  return (
    <mesh geometry={SHAPES[p.shape]} position={[p.offset[0] + origin[0], p.offset[1] + origin[1], p.offset[2] + origin[2]]} scale={p.size}>
      <meshToonMaterial gradientMap={toonRamp} color={map ? '#ffffff' : p.color} map={map ?? null} />
    </mesh>
  )
}

// A single character built from meshes: the player and named NPCs.
// The ref exposes `animate(pose)`; poses come from computePose in people.js.
const Person = forwardRef(function Person({ look, shirtMap, faceOverride, ...props }, ref) {
  const parts = useMemo(() => personParts(look), [look])
  const face = useMemo(() => makeFaceTexture(faceOverride ?? faceStyle(look.face)), [look, faceOverride])
  const limbs = useMemo(() => {
    const groups = {}
    parts.forEach((p, i) => isLimb(p.group) && (groups[p.group] ??= { pivot: p.pivot, parts: [] }).parts.push({ p, i }))
    return groups
  }, [parts])
  const torso = parts.findIndex((p) => p.group === 'body' && p.pivot[1] > 1.1 && p.pivot[1] < 1.3)
  const root = useRef()
  const head = useRef()
  const limbRefs = useRef({})

  useImperativeHandle(ref, () => ({
    animate(p) {
      const r = root.current
      if (!r) return
      r.position.y = p.bob
      r.rotation.set(p.lean, p.twist, 0)
      r.scale.set(p.sxz, p.sy, p.sxz)
      head.current.rotation.set(p.headNod, 0, p.headTilt)
      for (const name of ['legL', 'legR', 'armL', 'armR']) {
        if (limbRefs.current[name]) limbRefs.current[name].rotation.x = p[name]
      }
    },
  }))

  return (
    <group scale={look.height} {...props}>
      <group ref={root}>
        {Object.entries(limbs).map(([name, g]) => (
          <group key={name} position={g.pivot} rotation-z={SPLAY[name] ?? 0}>
            <group ref={(el) => (limbRefs.current[name] = el)}>
              {g.parts.map(({ p, i }) => (
                <Part key={i} p={p} origin={[0, 0, 0]} />
              ))}
            </group>
          </group>
        ))}
        {parts.map((p, i) => (p.group === 'body' ? <Part key={i} p={p} origin={p.pivot} map={i === torso ? shirtMap : null} /> : null))}
        <group ref={head} position={NECK}>
          {parts.map((p, i) => (p.group === 'head' ? <Part key={i} p={p} origin={[0, 0, 0]} /> : null))}
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
