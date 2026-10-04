import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, CoefficientCombineRule, RigidBody, useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { city, footbridgeFloor } from './cityData'
import { makeAnkaraTexture } from './faces'
import Person from './Person'
import { computePose } from './people'
import { Blob } from './Shadows'
import EmoteBubble from './EmoteBubble'
import { WATER_Y } from './Water'
import { hasPattern, lookFromOutfit, playerFace } from './wardrobe'
import { useGame, world } from './state'

// Like in Messenger, the everyday pace is a jog; Shift is a flat-out sprint.
const JOG = 6.5
const SPRINT = 9.5
const JUMP = 6
const SWIM = 3.2 // m/s in the water (Shift: a bit faster)
const FLOAT_Y = WATER_Y - 0.55 // capsule center while swimming: head above the water
const FOOT_OFFSET = 0.9 // capsule center to the soles of the feet

// The player: a boy or a girl, dressed from the wardrobe (wardrobe.js).
const PUNCH_TIME = 0.32

const pose = {}
const poseIn = {}

const move = new Vector3()

export default function Player() {
  const body = useRef()
  const visual = useRef()
  const anchor = useRef()
  const person = useRef()
  const anim = useRef({ facing: Math.PI, phase: 0 })
  const { rapier, world: physics } = useRapier()
  const [, getKeys] = useKeyboardControls()
  const mode = useGame((s) => s.mode)
  const flying = useGame((s) => !!s.flight)
  const carry = useGame((s) => s.carry)
  const carryColor = useGame((s) => s.carryColor)
  const outfit = useGame((s) => s.outfit)
  const gender = useGame((s) => s.gender)
  const look = useMemo(() => lookFromOutfit(outfit, null, gender), [outfit, gender])
  const face = useMemo(() => playerFace(gender), [gender])
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
    const frozen = game.phase !== 'playing' || !!game.dialogue || !!game.busted || !!game.wasted || down || !!game.chatOpen || !!game.panel || !!world.raceHold || !!world.flight || !!world.guardHold

    const { forward, back, left, right, run, jump } = frozen ? {} : getKeys()

    // Movement is relative to where the camera is looking.
    const yaw = world.cameraYaw
    const ahead = Number(!!forward) - Number(!!back)
    const side = Number(!!right) - Number(!!left)
    move.set(-Math.sin(yaw) * ahead + Math.cos(yaw) * side, 0, -Math.cos(yaw) * ahead - Math.sin(yaw) * side)
    const moving = move.lengthSq() > 0
    if (moving) move.normalize()

    const p0 = b.translation()
    // In the lagoon or the sea: float at the surface and swim.
    const swimming = !game.inside && p0.y < WATER_Y + 0.25
    // No gravity in the water, so the float holds at any frame rate.
    if (swimming !== world.swimming) b.setGravityScale(swimming ? 0 : 1, true)
    world.swimming = swimming
    const speed = swimming ? (run ? SWIM * 1.35 : SWIM) : run ? SPRINT : JOG
    const v = b.linvel()
    // While knocked down, let physics carry the body instead of the controls.
    if (swimming) {
      // Buoyancy: ease back up to the surface, however deep you went in.
      const vy = Math.max(-6, Math.min(4, (FLOAT_Y - p0.y) * 4))
      b.setLinvel({ x: move.x * speed, y: vy, z: move.z * speed }, true)
      // Swimming up to a quay, a beach or a bridge pier: climb out.
      if (moving && !frozen) {
        const ax = p0.x + move.x * 0.9
        const az = p0.z + move.z * 0.9
        const hit = physics.castRay(new rapier.Ray({ x: ax, y: 4, z: az }, { x: 0, y: -1, z: 0 }), 9, true, undefined, undefined, undefined, b)
        const ground = hit ? 4 - hit.timeOfImpact : -Infinity
        if (ground > WATER_Y + 0.2 && ground < WATER_Y + 2.6) {
          b.setTranslation({ x: ax, y: ground + FOOT_OFFSET + 0.15, z: az }, true)
          b.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
      }
    } else if (!down) {
      // On a footbridge's stairs or deck: keep the feet on the steps, so
      // walking up and down is smooth rather than a scramble up a slope.
      const floor = footbridgeFloor(p0.x, p0.z)
      const feet = p0.y - FOOT_OFFSET
      const onStairs = floor !== null && feet > floor - 0.8 && feet < floor + 0.5 && !(jump && v.y > 1)
      b.setLinvel({ x: move.x * speed, y: onStairs ? Math.max(-8, Math.min(8, (floor + 0.02 - feet) * 14)) : v.y, z: move.z * speed }, true)
    }
    // Never let a bad shove (from a teleporting body, say) launch him.
    else if (Math.hypot(v.x, v.y, v.z) > 30) b.setLinvel({ x: 0, y: Math.min(v.y, 0), z: 0 }, true)
    if (v.y > 25) b.setLinvel({ x: v.x, y: 0, z: v.z }, true)

    const p = b.translation()
    const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 })
    const grounded = physics.castRay(ray, FOOT_OFFSET + 0.1, true, undefined, undefined, undefined, b) !== null
    if (jump && grounded && !swimming && v.y < 0.5) b.setLinvel({ x: move.x * speed, y: JUMP, z: move.z * speed }, true)

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
    a.phase += dt * (moving ? speed * 1.75 : 0)
    const punch = world.punch
    if (punch) {
      punch.t += dt / PUNCH_TIME
      if (punch.t > 1) world.punch = null
    }
    poseIn.phase = a.phase
    poseIn.t = a.time
    poseIn.moving = moving && (grounded || swimming)
    poseIn.run = true // he jogs everywhere
    poseIn.sprint = !!run
    poseIn.punch = punch ? punch.t : -1
    poseIn.punchSide = punch?.side ?? 1
    poseIn.flinch = world.flinch / 0.4
    computePose(pose, poseIn)
    if (world.eating) {
      // Spoon to mouth, chew, repeat.
      const k = (Math.sin(a.time * 5) + 1) / 2
      pose.armR = -0.9 - k * 0.35
      pose.foreR = -1.7 - k * 0.45
      pose.headNod = 0.12 + k * 0.05
    } else if (world.carry && !world.punch) {
      // Carrying a bag: that arm hangs straight and just sways a little.
      pose.armR *= 0.35
      pose.foreR = -0.18
    }
    if (world.workout > 0) {
      // Working out at the gym: arms pumping overhead.
      world.workout -= dt
      // Dumbbell curls at the gym.
      const k = (Math.sin(a.time * 4) + 1) / 2
      pose.armL = pose.armR = -0.25
      pose.foreL = pose.foreR = -0.2 - k * 2.1
    }
    if (swimming) {
      // Front crawl: arms windmilling in turn, legs kicking.
      const k = a.time * (moving ? 5 : 2)
      pose.armL = -1.6 + Math.sin(k) * 1.5
      pose.armR = -1.6 - Math.sin(k) * 1.5
      pose.foreL = pose.foreR = -0.3
      pose.legL = Math.sin(k * 2) * 0.3
      pose.legR = -Math.sin(k * 2) * 0.3
      pose.shinL = pose.shinR = 0.15
      pose.bob = Math.sin(a.time * 3) * 0.03
      pose.headNod = -0.6
    } else if (!grounded && !down) {
      // In the air: one knee tucked up, arms thrown up and out.
      pose.legL = -0.9
      pose.shinL = 1.3
      pose.legR = 0.25
      pose.shinR = 0.7
      pose.armL = pose.armR = -2.3
      pose.foreL = pose.foreR = -0.4
      pose.splayL = 0.5
      pose.splayR = -0.5
    }
    person.current?.animate(pose)
    // Lying flat while knocked down.
    // Lying flat while knocked down; face down and stretched out while swimming.
    const tilt = down ? -Math.PI / 2 : swimming ? (moving ? 1.25 : 0.5) : 0
    visual.current.rotation.x += (tilt - visual.current.rotation.x) * Math.min(1, dt * (swimming ? 5 : 12))
    visual.current.position.y = -FOOT_OFFSET + (down ? 0.2 : swimming ? 0.55 : 0)

    // Follow the smoothed position he's drawn at (see Car.jsx) so the camera
    // doesn't judder when the frame rate and the 60 Hz physics drift apart.
    if (anchor.current) anchor.current.getWorldPosition(world.focus)
    else world.focus.set(p.x, p.y, p.z)
    world.heading = a.facing
  })

  return (
    <RigidBody ref={body} colliders={false} position={city.spawn} enabledRotations={[false, false, false]} canSleep={false}>
      <CapsuleCollider args={[0.55, 0.35]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <group ref={visual} position-y={-FOOT_OFFSET} visible={mode === 'foot' && !flying}>
        <Person ref={person} look={look} shirtMap={hasPattern(outfit) ? shirt : null} faceOverride={face} carry={carry} carryColor={carryColor} />
        <Blob position-y={0.03} scale={[0.9, 1, 0.9]} />
      </group>
      {mode === 'foot' && <EmoteBubble get={() => world.emote} y={1.4} />}
      <group ref={anchor} />
    </RigidBody>
  )
}
