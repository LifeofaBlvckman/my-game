import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, CoefficientCombineRule, RigidBody, useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { city } from './cityData'
import { makeAnkaraTexture } from './faces'
import Person from './Person'
import { Blob } from './Shadows'
import { useGame, world } from './state'

const WALK = 4.5
const RUN = 9
const JUMP = 6
const FOOT_OFFSET = 0.9 // capsule center to the soles of the feet

// Tunde: Ankara shirt, jeans, low cut and a beard.
export const PLAYER_LOOK = { face: 1, skin: '#4f2f1c', female: false, top: '#ffffff', bottom: '#2c4f86', hair: 'short', hairColor: '#120c08', robe: false, height: 1 }
const PLAYER_FACE = { skin: '#4f2f1c', female: false, beard: true, smile: true }

const move = new Vector3()

export default function Player() {
  const body = useRef()
  const visual = useRef()
  const person = useRef()
  const anim = useRef({ facing: Math.PI, phase: 0 })
  const { rapier, world: physics } = useRapier()
  const [, getKeys] = useKeyboardControls()
  const mode = useGame((s) => s.mode)
  const shirt = useMemo(makeAnkaraTexture, [])

  useEffect(() => {
    world.player = body.current
    world.focus.set(...city.spawn)
  }, [])

  useFrame((_, rawDt) => {
    const b = body.current
    const game = useGame.getState()
    if (!b || game.mode !== 'foot') return
    const dt = Math.min(rawDt, 0.1)
    const frozen = game.phase !== 'playing' || !!game.dialogue || !!game.busted

    const { forward, back, left, right, run, jump } = frozen ? {} : getKeys()

    // Movement is relative to where the camera is looking.
    const yaw = world.cameraYaw
    const ahead = Number(!!forward) - Number(!!back)
    const side = Number(!!right) - Number(!!left)
    move.set(-Math.sin(yaw) * ahead + Math.cos(yaw) * side, 0, -Math.cos(yaw) * ahead - Math.sin(yaw) * side)
    const moving = move.lengthSq() > 0
    if (moving) move.normalize()

    const speed = run ? RUN : WALK
    const v = b.linvel()
    b.setLinvel({ x: move.x * speed, y: v.y, z: move.z * speed }, true)

    const p = b.translation()
    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const grounded = physics.castRay(ray, FOOT_OFFSET + 0.1, true, undefined, undefined, undefined, b) !== null
    if (jump && grounded && v.y < 0.5) b.setLinvel({ x: move.x * speed, y: JUMP, z: move.z * speed }, true)

    // Turn to face the direction of travel, taking the short way around.
    const a = anim.current
    if (moving) {
      const target = Math.atan2(move.x, move.z)
      const diff = Math.atan2(Math.sin(target - a.facing), Math.cos(target - a.facing))
      a.facing += diff * Math.min(1, dt * 12)
    }
    visual.current.rotation.y = a.facing

    a.phase += dt * (moving ? speed * 1.7 : 1.5)
    const swing = moving && grounded ? Math.sin(a.phase) * (run ? 0.9 : 0.6) : 0
    person.current?.animate(swing, moving ? swing : Math.sin(a.phase) * 0.05)

    world.focus.set(p.x, p.y, p.z)
    world.heading = a.facing
  })

  return (
    <RigidBody ref={body} colliders={false} position={city.spawn} enabledRotations={[false, false, false]} canSleep={false}>
      <CapsuleCollider args={[0.55, 0.35]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <group ref={visual} position-y={-FOOT_OFFSET} visible={mode === 'foot'}>
        <Person ref={person} look={PLAYER_LOOK} shirtMap={shirt} faceOverride={PLAYER_FACE} />
        <Blob position-y={0.03} scale={[0.9, 1, 0.9]} />
      </group>
    </RigidBody>
  )
}
