import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, CoefficientCombineRule, RigidBody, useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { city } from './cityData'
import { makeAnkaraTexture } from './faces'
import Person from './Person'
import { computePose } from './people'
import { Blob } from './Shadows'
import { useGame, world } from './state'

const WALK = 4.5
const RUN = 9
const JUMP = 6
const FOOT_OFFSET = 0.9 // capsule center to the soles of the feet

// Tunde: Ankara shirt, jeans, low cut and a beard.
export const PLAYER_LOOK = { face: 1, skin: '#6e4430', female: false, top: '#e07b1a', bottom: '#3a63a8', hair: 'short', hairColor: '#1f1410', robe: false, height: 1 }
export const PLAYER_FACE = { female: false, beard: true, mouth: 'grin', brows: true }
const PUNCH_TIME = 0.32

const pose = {}
const poseIn = {}

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
    // Yaw first, then pitch, so falling over follows the way he's facing.
    visual.current.rotation.order = 'YXZ'
  }, [])

  useFrame((_, rawDt) => {
    const b = body.current
    const game = useGame.getState()
    if (!b || game.mode !== 'foot') return
    const dt = Math.min(rawDt, 0.1)
    world.playerDown = Math.max(0, (world.playerDown ?? 0) - dt)
    world.flinch = Math.max(0, (world.flinch ?? 0) - dt)
    const down = world.playerDown > 0
    const frozen = game.phase !== 'playing' || !!game.dialogue || !!game.busted || !!game.wasted || down || !!game.chatOpen

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
    // While knocked down, let physics carry the body instead of the controls.
    if (!down) b.setLinvel({ x: move.x * speed, y: v.y, z: move.z * speed }, true)

    const p = b.translation()
    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const grounded = physics.castRay(ray, FOOT_OFFSET + 0.1, true, undefined, undefined, undefined, b) !== null
    if (jump && grounded && v.y < 0.5) b.setLinvel({ x: move.x * speed, y: JUMP, z: move.z * speed }, true)

    // Turn to face the direction of travel, taking the short way around.
    const a = anim.current
    if (world.forceFacing !== undefined) {
      a.facing = world.forceFacing
      world.forceFacing = undefined
    }
    if (moving) {
      const target = Math.atan2(move.x, move.z)
      const diff = Math.atan2(Math.sin(target - a.facing), Math.cos(target - a.facing))
      a.facing += diff * Math.min(1, dt * 12)
    }
    visual.current.rotation.y = a.facing

    a.time = (a.time ?? 0) + dt
    a.phase += dt * (moving ? speed * 1.8 : 0)
    const punch = world.punch
    if (punch) {
      punch.t += dt / PUNCH_TIME
      if (punch.t > 1) world.punch = null
    }
    poseIn.phase = a.phase
    poseIn.t = a.time
    poseIn.moving = moving && grounded
    poseIn.run = !!run
    poseIn.punch = punch ? punch.t : -1
    poseIn.punchSide = punch?.side ?? 1
    poseIn.flinch = world.flinch / 0.4
    computePose(pose, poseIn)
    if (world.workout > 0) {
      // Working out at the gym: arms pumping overhead.
      world.workout -= dt
      pose.armL = pose.armR = -0.3 - ((Math.sin(a.time * 4) + 1) / 2) * 2.6
    }
    if (!grounded && !down) {
      pose.legL = 0.5
      pose.legR = -0.3
      pose.armL = pose.armR = -2.4
      pose.sy = 1.08
    }
    person.current?.animate(pose)
    // Lying flat while knocked down.
    visual.current.rotation.x += ((down ? -Math.PI / 2 : 0) - visual.current.rotation.x) * Math.min(1, dt * 12)
    visual.current.position.y = -FOOT_OFFSET + (down ? 0.2 : 0)

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
