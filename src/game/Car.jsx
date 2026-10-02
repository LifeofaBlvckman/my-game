import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CoefficientCombineRule, CuboidCollider, RigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { city } from './cityData'
import { useGame, world } from './state'
import { partColor, VEHICLES } from './vehicleTypes'
import { setEngine } from './audio'
import { Blob } from './Shadows'
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

function Body({ type, color }) {
  const def = VEHICLES[type]
  return def.parts.map((p, i) =>
    p[7] ? (
      <mesh key={i} position={[p[0], p[1], p[2]]}>
        <boxGeometry args={[p[3], p[4], p[5]]} />
        <meshBasicMaterial color={partColor(p, color)} toneMapped={false} />
      </mesh>
    ) : (
      <mesh key={i} position={[p[0], p[1], p[2]]}>
        <boxGeometry args={[p[3], p[4], p[5]]} />
        <meshToonMaterial gradientMap={toonRamp} color={partColor(p, color)} />
      </mesh>
    ),
  )
}

export default function Car() {
  const body = useRef()
  const wheelSpin = useRef([])
  const wheelSteer = useRef([])
  const steer = useRef(0)
  const [, getKeys] = useKeyboardControls()
  const type = useGame((s) => s.carType)
  const color = useGame((s) => s.carColor)
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
    const driving = game.mode === 'car' && game.phase === 'playing' && !game.dialogue
    const keys = driving ? getKeys() : {}

    const r = b.rotation()
    q.set(r.x, r.y, r.z, r.w)
    fwd.set(0, 0, 1).applyQuaternion(q)
    fwd.y = 0
    fwd.normalize()

    const v = b.linvel()
    let speed = v.x * fwd.x + v.z * fwd.z
    let latX = v.x - fwd.x * speed
    let latZ = v.z - fwd.z * speed

    const throttle = Number(!!keys.forward) - Number(!!keys.back)
    if (throttle !== 0) {
      const braking = Math.abs(speed) > 0.5 && Math.sign(speed) !== throttle
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

    // Steering only turns the car while it's rolling, and tightens at low speed.
    const steerInput = Number(!!keys.left) - Number(!!keys.right)
    steer.current += (steerInput - steer.current) * Math.min(1, dt * 8)
    const rolling = Math.max(-1, Math.min(1, speed / 6))
    const yawRate = (steer.current * def.steer * rolling * (keys.jump ? 1.4 : 1)) / (1 + Math.abs(speed) / 35)
    b.setAngvel({ x: 0, y: yawRate, z: 0 }, true)

    wheelSpin.current.forEach((w) => w && (w.rotation.x += (speed * dt) / def.wheels.r))
    wheelSteer.current.forEach((w) => w && (w.rotation.y = steer.current * 0.5))

    world.carHeading = Math.atan2(fwd.x, fwd.z)
    if (game.mode === 'car') {
      const p = b.translation()
      world.focus.set(p.x, p.y, p.z)
      world.heading = world.carHeading
      world.carSpeed = speed
    }
    setEngine(game.mode === 'car', speed)
  })

  return (
    <RigidBody ref={body} colliders={false} position={city.carSpawn} rotation={[0, Math.PI, 0]} enabledRotations={[false, true, false]} canSleep={false}>
      <CuboidCollider key={type} args={def.half} mass={1200} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <Body type={type} color={color} />
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
    </RigidBody>
  )
}
