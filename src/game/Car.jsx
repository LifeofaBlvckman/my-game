import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CoefficientCombineRule, CuboidCollider, RigidBody } from '@react-three/rapier'
import { Quaternion, Vector3 } from 'three'
import { city } from './cityData'
import { useGame, world } from './state'

// Arcade handling: we drive the body's velocity directly instead of simulating
// tires. Easy to tune and stable, which matters more than realism for a SA feel.
const ACCEL = 10
const REVERSE_ACCEL = 8
const BRAKE = 32
const ROLLING_DRAG = 4
const MAX_SPEED = 45 // m/s, about 160 km/h
const MAX_REVERSE = 12
const GRIP = 12 // how fast sideways sliding is killed
const DRIFT_GRIP = 1.5 // handbrake grip
const STEER_RATE = 2.2

const WHEEL_RADIUS = 0.4
const WHEELS = [
  [0.85, -0.1, 1.3, true],
  [-0.85, -0.1, 1.3, true],
  [0.85, -0.1, -1.3, false],
  [-0.85, -0.1, -1.3, false],
]

const q = new Quaternion()
const fwd = new Vector3()

export default function Car() {
  const body = useRef()
  const wheelSpin = useRef([])
  const wheelSteer = useRef([])
  const steer = useRef(0)
  const [, getKeys] = useKeyboardControls()

  useEffect(() => {
    world.car = body.current
  }, [])

  useFrame((_, dt) => {
    const b = body.current
    if (!b) return
    const driving = useGame.getState().mode === 'car'
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
      const accel = braking ? BRAKE : throttle > 0 ? ACCEL : REVERSE_ACCEL
      speed += throttle * accel * dt
    } else {
      speed -= Math.sign(speed) * Math.min(Math.abs(speed), ROLLING_DRAG * dt)
    }
    if (keys.jump) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 18 * dt)
    speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, speed))

    const grip = Math.exp(-(keys.jump ? DRIFT_GRIP : GRIP) * dt)
    latX *= grip
    latZ *= grip
    b.setLinvel({ x: fwd.x * speed + latX, y: v.y, z: fwd.z * speed + latZ }, true)

    // Steering only turns the car while it's rolling, and tightens at low speed.
    const steerInput = Number(!!keys.left) - Number(!!keys.right)
    steer.current += (steerInput - steer.current) * Math.min(1, dt * 8)
    const rolling = Math.max(-1, Math.min(1, speed / 6))
    const yawRate = steer.current * STEER_RATE * rolling * (keys.jump ? 1.4 : 1) / (1 + Math.abs(speed) / 35)
    b.setAngvel({ x: 0, y: yawRate, z: 0 }, true)

    wheelSpin.current.forEach((w) => w && (w.rotation.x += (speed * dt) / WHEEL_RADIUS))
    wheelSteer.current.forEach((w) => w && (w.rotation.y = steer.current * 0.5))

    if (driving) {
      const p = b.translation()
      world.focus.set(p.x, p.y, p.z)
      world.heading = Math.atan2(fwd.x, fwd.z)
      world.carSpeed = Math.abs(speed)
    }
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={city.carSpawn}
      enabledRotations={[false, true, false]}
      canSleep={false}
    >
      <CuboidCollider args={[0.95, 0.5, 2.15]} mass={1200} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      {/* Body */}
      <mesh position-y={0.1}>
        <boxGeometry args={[1.9, 0.6, 4.3]} />
        <meshLambertMaterial color="#3d7a3a" />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.7, -0.3]}>
        <boxGeometry args={[1.7, 0.6, 2.2]} />
        <meshLambertMaterial color="#2d5a2b" />
      </mesh>
      {/* Windshield and rear window */}
      <mesh position={[0, 0.7, 0.81]}>
        <boxGeometry args={[1.5, 0.48, 0.02]} />
        <meshLambertMaterial color="#9fc4d6" />
      </mesh>
      <mesh position={[0, 0.7, -1.41]}>
        <boxGeometry args={[1.5, 0.48, 0.02]} />
        <meshLambertMaterial color="#9fc4d6" />
      </mesh>
      {/* Lights */}
      {[0.65, -0.65].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.15, 2.16]}>
            <boxGeometry args={[0.35, 0.18, 0.02]} />
            <meshBasicMaterial color="#fff6d0" />
          </mesh>
          <mesh position={[x, 0.15, -2.16]}>
            <boxGeometry args={[0.35, 0.18, 0.02]} />
            <meshBasicMaterial color="#c0262a" />
          </mesh>
        </group>
      ))}
      {/* Wheels */}
      {WHEELS.map(([x, y, z, front], i) => (
        <group key={i} position={[x, y, z]} ref={(el) => front && (wheelSteer.current[i] = el)}>
          <mesh ref={(el) => (wheelSpin.current[i] = el)}>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 8]} />
              <meshLambertMaterial color="#1c1c1c" />
            </mesh>
            <mesh rotation-z={Math.PI / 2}>
              <boxGeometry args={[0.3, 0.32, 0.12]} />
              <meshLambertMaterial color="#aaaaaa" />
            </mesh>
          </mesh>
        </group>
      ))}
    </RigidBody>
  )
}
