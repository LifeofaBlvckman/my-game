import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, CoefficientCombineRule, RigidBody, useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { city } from './cityData'
import { useGame, world } from './state'

const WALK = 4.5
const RUN = 9
const JUMP = 6
const FOOT_OFFSET = 0.9 // capsule center to the soles of the feet

const move = new Vector3()

export default function Player() {
  const body = useRef()
  const visual = useRef()
  const leftLeg = useRef()
  const rightLeg = useRef()
  const leftArm = useRef()
  const rightArm = useRef()
  const anim = useRef({ facing: 0, phase: 0 })
  const { rapier, world: physics } = useRapier()
  const [, getKeys] = useKeyboardControls()
  const mode = useGame((s) => s.mode)

  useEffect(() => {
    world.player = body.current
  }, [])

  useFrame((_, dt) => {
    const b = body.current
    if (!b || useGame.getState().mode !== 'foot') return

    const { forward, back, left, right, run, jump } = getKeys()

    // Movement is relative to where the camera is looking.
    const yaw = world.cameraYaw
    const ahead = Number(forward) - Number(back)
    const side = Number(right) - Number(left)
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

    // Simple limb swing.
    a.phase += dt * (moving ? speed * 1.7 : 0)
    const swing = moving && grounded ? Math.sin(a.phase) * (run ? 0.9 : 0.6) : 0
    leftLeg.current.rotation.x = swing
    rightLeg.current.rotation.x = -swing
    leftArm.current.rotation.x = -swing * 0.8
    rightArm.current.rotation.x = swing * 0.8

    world.focus.set(p.x, p.y, p.z)
    world.heading = a.facing
  })

  const skin = '#6b4630'
  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={city.spawn}
      enabledRotations={[false, false, false]}
      canSleep={false}
    >
      <CapsuleCollider args={[0.55, 0.35]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      <group ref={visual} position-y={-FOOT_OFFSET} visible={mode === 'foot'}>
        <group ref={leftLeg} position={[0.14, 0.85, 0]}>
          <mesh position-y={-0.42}>
            <boxGeometry args={[0.24, 0.85, 0.26]} />
            <meshLambertMaterial color="#2c4f86" />
          </mesh>
        </group>
        <group ref={rightLeg} position={[-0.14, 0.85, 0]}>
          <mesh position-y={-0.42}>
            <boxGeometry args={[0.24, 0.85, 0.26]} />
            <meshLambertMaterial color="#2c4f86" />
          </mesh>
        </group>
        <mesh position-y={1.2}>
          <boxGeometry args={[0.58, 0.72, 0.32]} />
          <meshLambertMaterial color="#f2f2ec" />
        </mesh>
        <group ref={leftArm} position={[0.38, 1.5, 0]}>
          <mesh position-y={-0.32}>
            <boxGeometry args={[0.16, 0.66, 0.18]} />
            <meshLambertMaterial color={skin} />
          </mesh>
        </group>
        <group ref={rightArm} position={[-0.38, 1.5, 0]}>
          <mesh position-y={-0.32}>
            <boxGeometry args={[0.16, 0.66, 0.18]} />
            <meshLambertMaterial color={skin} />
          </mesh>
        </group>
        <mesh position-y={1.74}>
          <boxGeometry args={[0.32, 0.34, 0.32]} />
          <meshLambertMaterial color={skin} />
        </mesh>
        {/* Bandana so you can tell which way he's facing */}
        <mesh position={[0, 1.86, 0.02]}>
          <boxGeometry args={[0.34, 0.1, 0.34]} />
          <meshLambertMaterial color="#2f8a3a" />
        </mesh>
      </group>
    </RigidBody>
  )
}
