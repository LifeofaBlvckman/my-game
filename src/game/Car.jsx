import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CoefficientCombineRule, CuboidCollider, RigidBody } from '@react-three/rapier'
import { BoxGeometry, Quaternion, TorusGeometry, Vector3 } from 'three'
import { city } from './cityData'
import { useGame, world } from './state'
import { partColor, partKind, VEHICLES } from './vehicleTypes'
import Driver from './Driver'
import { seatMatrix, steeringWheel } from './drivers'
import { PLAYER_FACE } from './Player'
import { lookFromOutfit } from './wardrobe'
import { setEngine } from './audio'
import { Blob } from './Shadows'
import { fx } from './particles'
import { carBox } from './shapes'
import { CAR_HP, crash, damagePlayerCar, damageVehicle, explode, vehicleSmoke } from './damage'
import { vehicles } from './trafficSim'
import { toonRamp } from './materials'

// Arcade handling: we drive the body's velocity directly instead of simulating
// tires. Easy to tune and stable, which matters more than realism for a SA feel.
const BRAKE = 32
const ROLLING_DRAG = 4
const MAX_REVERSE = 12
const GRIP = 12 // how fast sideways sliding is killed
const DRIFT_GRIP = 1.5 // handbrake grip

const q = new Quaternion()
const fwd = new Vector3()

function partMaterial(p, color) {
  const kind = partKind(p)
  if (kind === 'glow') return <meshBasicMaterial color={partColor(p, color)} toneMapped={false} />
  if (kind === 'glass') return <meshToonMaterial gradientMap={toonRamp} color={partColor(p, color)} transparent opacity={0.35} depthWrite={false} />
  return <meshToonMaterial gradientMap={toonRamp} color={partColor(p, color)} />
}

const wheelRing = new TorusGeometry(0.18, 0.025, 5, 14)

// The vehicle's bodywork, steering wheel, and optionally whoever is inside.
export function Body({ type, color, driver, driverFace, riders = [] }) {
  const def = VEHICLES[type]
  const seat = useMemo(() => seatMatrix(def.seat).multiply(steeringWheel), [def])
  return (
    <>
      <mesh geometry={wheelRing} matrix={seat} matrixAutoUpdate={false}>
        <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
      </mesh>
      {riders.slice(0, def.passengers.length).map((r, i) => (
        <Driver key={i} look={r} seat={def.passengers[i]} driving={false} />
      ))}
      {def.parts.map((p, i) => (
        <mesh key={i} geometry={partKind(p) === 'lit' ? carBox : plainBox} position={[p[0], p[1], p[2]]} scale={[p[3], p[4], p[5]]}>
          {partMaterial(p, color)}
        </mesh>
      ))}
      {driver && <Driver look={driver} seat={def.seat} faceOverride={driverFace} />}
    </>
  )
}

const CRASH_THRESHOLD = 6
const plainBox = new BoxGeometry(1, 1, 1)

const anchorDir = new Vector3()

export default function Car() {
  const body = useRef()
  const anchor = useRef()
  const wheelSpin = useRef([])
  const wheelSteer = useRef([])
  const steer = useRef(0)
  const lastVel = useRef({ x: 0, z: 0 })
  const [, getKeys] = useKeyboardControls()
  const type = useGame((s) => s.carType)
  const inCar = useGame((s) => s.mode === 'car')
  const riders = useGame((s) => s.riders)
  const color = useGame((s) => s.carColor)
  const outfit = useGame((s) => s.outfit)
  const driverLook = useMemo(() => lookFromOutfit(outfit), [outfit])
  const def = VEHICLES[type]
  const wheels = useMemo(() => def.wheels.at.map((w, i) => ({ w, front: w[2] > 0, i })), [def])

  useEffect(() => {
    world.car = body.current
  }, [])

  useFrame((_, rawDt) => {
    const b = body.current
    if (!b) return
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()
    const driving = game.mode === 'car' && game.phase === 'playing' && !game.dialogue && !game.panel && !world.carWrecked && !game.chatOpen && !game.wasted && !game.busted
    const keys = driving && !world.raceHold ? getKeys() : {} // held on the start line until GO

    const r = b.rotation()
    q.set(r.x, r.y, r.z, r.w)
    fwd.set(0, 0, 1).applyQuaternion(q)
    fwd.y = 0
    fwd.normalize()

    const v = b.linvel()
    const pos = b.translation()

    // A sudden change in velocity that we didn't cause means we hit something.
    const impact = Math.hypot(v.x - lastVel.current.x, v.z - lastVel.current.z)
    if (impact > CRASH_THRESHOLD && performance.now() > (world.carSkipCrash ?? 0)) {
      const dir = Math.hypot(lastVel.current.x, lastVel.current.z) || 1
      const hx = pos.x + (lastVel.current.x / dir) * def.half[2]
      const hz = pos.z + (lastVel.current.z / dir) * def.half[2]
      crash(hx, pos.y + 0.3, hz, impact, color)
      damagePlayerCar((impact - 4) * 3)
      // Whatever we hit takes damage too.
      for (const o of vehicles) {
        if (Math.hypot(o.x - hx, o.z - hz) < VEHICLES[o.type].half[2] + 1.5) {
          damageVehicle(o, impact * 2.5, impact)
          if (o.police) world.events.push({ type: 'copHit' })
        }
      }
    }

    let speed = v.x * fwd.x + v.z * fwd.z
    let latX = v.x - fwd.x * speed
    let latZ = v.z - fwd.z * speed

    // Touch: the stick gives smooth throttle (push up) and steering; the
    // pedals press the same keys as W and S.
    const stick = driving && !world.raceHold ? world.stick : null
    let throttle = Number(!!keys.forward) - Number(!!keys.back)
    if (stick && throttle === 0 && Math.abs(stick.y) > 0.3) throttle = Math.max(-1, Math.min(1, (-stick.y - Math.sign(-stick.y) * 0.3) / 0.6))
    if (throttle !== 0) {
      const braking = Math.abs(speed) > 0.5 && Math.sign(speed) !== Math.sign(throttle)
      const accel = braking ? BRAKE : throttle > 0 ? def.accel : def.accel * 0.8
      speed += throttle * accel * dt
    } else {
      speed -= Math.sign(speed) * Math.min(Math.abs(speed), ROLLING_DRAG * dt)
    }
    if (keys.jump) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 18 * dt)
    speed = Math.max(-MAX_REVERSE, Math.min(def.maxSpeed, speed))

    const grip = Math.exp(-(keys.jump ? DRIFT_GRIP : GRIP) * dt)
    latX *= grip
    latZ *= grip
    b.setLinvel({ x: fwd.x * speed + latX, y: v.y, z: fwd.z * speed + latZ }, true)
    lastVel.current.x = fwd.x * speed + latX
    lastVel.current.z = fwd.z * speed + latZ

    // Damage: smoke, then fire, then it blows up.
    const hood = def.half[2] * 0.7
    vehicleSmoke(pos.x + fwd.x * hood, pos.y + def.half[1] * 0.8, pos.z + fwd.z * hood, world.carHp ?? CAR_HP, CAR_HP, world.carBurning ?? 0, dt)
    if (world.carBurning > 0) {
      world.carBurning -= dt
      if (world.carBurning <= 0) {
        world.carWrecked = true
        world.carBurning = 0
        if (game.mode === 'car') world.events.push({ type: 'eject' })
        useGame.setState({ carColor: '#2b2626' })
        explode(pos.x, pos.z, 'playerCar')
      }
    }
    // Tire smoke when drifting.
    if (keys.jump && Math.abs(speed) > 8 && Math.random() < dt * 25) {
      fx.dust(pos.x - fwd.x * def.half[2], 0.15, pos.z - fwd.z * def.half[2], 1)
    }

    // Steering only turns the car while it's rolling, and tightens at low speed.
    let steerInput = Number(!!keys.left) - Number(!!keys.right)
    if (stick) {
      // A small dead zone, gentle near the middle, and less lock at speed so
      // a thumb can hold a straight line on the expressway.
      const x = Math.abs(stick.x) < 0.08 ? 0 : -stick.x
      steerInput = Math.sign(x) * Math.abs(x) ** 1.5 * (1 - Math.min(0.4, Math.abs(speed) / 70))
    }
    steer.current += (steerInput - steer.current) * Math.min(1, dt * (stick ? 10 : 8))
    const rolling = Math.max(-1, Math.min(1, speed / 6))
    const yawRate = (steer.current * def.steer * rolling * (keys.jump ? 1.4 : 1)) / (1 + Math.abs(speed) / 35)
    b.setAngvel({ x: 0, y: yawRate, z: 0 }, true)

    wheelSpin.current.forEach((w) => w && (w.rotation.x += (speed * dt) / def.wheels.r))
    wheelSteer.current.forEach((w) => w && (w.rotation.y = steer.current * 0.5))

    world.carHeading = Math.atan2(fwd.x, fwd.z)
    if (game.mode === 'car') {
      // Follow the smoothed (interpolated) position the car is drawn at, not
      // the raw physics step, or the camera judders whenever the frame rate
      // doesn't line up with the 60 Hz physics.
      if (anchor.current) {
        anchor.current.getWorldPosition(world.focus)
        anchor.current.getWorldDirection(anchorDir)
        world.heading = Math.atan2(anchorDir.x, anchorDir.z)
      } else {
        world.focus.set(pos.x, pos.y, pos.z)
        world.heading = world.carHeading
      }
      world.carSpeed = speed
    }
    setEngine(game.mode === 'car', speed)
  })

  return (
    <RigidBody ref={body} colliders={false} position={city.carSpawn} rotation={[0, city.carSpawnYaw, 0]} enabledRotations={[false, true, false]} canSleep={false}>
      <CuboidCollider key={type} args={def.half} mass={1200} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <Body type={type} color={color} driver={inCar ? driverLook : null} driverFace={PLAYER_FACE} riders={riders} />
      {wheels.map(({ w, front, i }) => (
        <group key={`${type}${i}`} position={w} ref={(el) => (wheelSteer.current[i] = front ? el : null)}>
          <mesh ref={(el) => (wheelSpin.current[i] = el)}>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[def.wheels.r, def.wheels.r, 0.28, 10]} />
              <meshToonMaterial gradientMap={toonRamp} color="#1a1a1a" />
            </mesh>
            <mesh rotation-z={Math.PI / 2}>
              <boxGeometry args={[0.29, def.wheels.r * 0.8, 0.12]} />
              <meshToonMaterial gradientMap={toonRamp} color="#aaaaaa" />
            </mesh>
          </mesh>
        </group>
      ))}
      <Blob position-y={-def.half[1] + 0.03} scale={[def.half[0] * 2.6, 1, def.half[2] * 2.4]} />
      <group ref={anchor} />
    </RigidBody>
  )
}
