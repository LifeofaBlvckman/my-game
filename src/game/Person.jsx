import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { Matrix4 } from 'three'
import { faceStyle, makeFaceTexture } from './faces'
import { CARRY, FACE, jointMatrices, makeJoints, personParts } from './people'
import { SHAPES } from './shapes'
import { toonRamp } from './materials'
import { inkOutline } from './outline'

const faceLocal = new Matrix4().makeTranslation(...FACE.offset).multiply(new Matrix4().makeScale(FACE.size[0], FACE.size[1], 1))

// A single character built from meshes: the player, named NPCs and other
// players. Same body and poses as the crowd (people.js), plus a bold ink
// outline. The ref exposes `animate(pose)`; poses come from computePose.
const Person = forwardRef(function Person({ look, shirtMap, faceOverride, outline = true, carry = null, carryColor = null, ...props }, ref) {
  const body = useMemo(() => personParts(look), [look])
  // Anything in hand rides on the forearm like the hand does.
  const parts = useMemo(() => [...body, ...(CARRY[carry] ?? []).map((p) => ({ ...p, color: p.color ?? carryColor ?? '#e8622c' }))], [body, carry, carryColor])
  const face = useMemo(() => makeFaceTexture(faceOverride ?? faceStyle(look.face)), [look, faceOverride])
  const torso = parts.findIndex((p) => p.joint === 'chest' && p.offset?.[1] === 1.2)
  const joints = useMemo(makeJoints, [])
  const meshes = useRef([])
  const faceMesh = useRef()

  useImperativeHandle(ref, () => ({
    animate(pose) {
      jointMatrices(pose, joints)
      parts.forEach((p, i) => {
        const m = meshes.current[i]
        if (!m) return
        m.main.matrix.multiplyMatrices(joints[p.joint], p.local)
        m.main.matrixWorldNeedsUpdate = true
        if (m.line) {
          m.line.matrix.copy(m.main.matrix)
          m.line.matrixWorldNeedsUpdate = true
        }
      })
      if (faceMesh.current) {
        faceMesh.current.matrix.multiplyMatrices(joints.head, faceLocal)
        faceMesh.current.matrixWorldNeedsUpdate = true
      }
    },
  }))

  const keep = (i, key) => (el) => {
    meshes.current[i] ??= {}
    meshes.current[i][key] = el
  }
  return (
    <group scale={look.height} {...props}>
      {parts.map((p, i) => (
        <group key={`${carry ?? ''}${i}`}>
          <mesh ref={keep(i, 'main')} geometry={SHAPES[p.shape]} matrixAutoUpdate={false} matrix={p.local}>
            {/* Keyed so taking the patterned shirt off really drops the texture. */}
            <meshToonMaterial key={i === torso && shirtMap ? 'map' : 'plain'} gradientMap={toonRamp} color={i === torso && shirtMap ? '#ffffff' : p.color} map={i === torso ? (shirtMap ?? null) : null} />
          </mesh>
          {outline && <mesh ref={keep(i, 'line')} geometry={SHAPES[p.shape]} material={inkOutline} matrixAutoUpdate={false} matrix={p.local} userData={{ noShadow: true }} />}
        </group>
      ))}
      <mesh ref={faceMesh} matrixAutoUpdate={false}>
        <planeGeometry args={[1, 1]} />
        <meshToonMaterial gradientMap={toonRamp} map={face} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
})

export default Person
