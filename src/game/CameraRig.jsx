import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { useGame, world } from './state'

const desired = new Vector3()
const lookAt = new Vector3()

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Third-person orbit camera. Click the game to capture the mouse, Esc to release.
export default function CameraRig() {
  const { camera, gl } = useThree()
  const { rapier, world: physics } = useRapier()

  useEffect(() => {
    const canvas = gl.domElement
    const lock = () => canvas.requestPointerLock?.()
    const onMove = (e) => {
      if (document.pointerLockElement !== canvas) return
      world.cameraYaw -= e.movementX * 0.0025
      world.cameraPitch = Math.min(1.2, Math.max(-0.1, world.cameraPitch + e.movementY * 0.002))
      world.lastMouseMove = performance.now()
    }
    canvas.addEventListener('click', lock)
    document.addEventListener('mousemove', onMove)
    return () => {
      canvas.removeEventListener('click', lock)
      document.removeEventListener('mousemove', onMove)
    }
  }, [gl])

  useFrame((_, dt) => {
    const driving = useGame.getState().mode === 'car'

    // While driving, swing back behind the car once the mouse has been idle.
    if (driving && performance.now() - world.lastMouseMove > 1200) {
      const behind = world.heading + Math.PI
      world.cameraYaw += wrapAngle(behind - world.cameraYaw) * Math.min(1, dt * 2.5)
      world.cameraPitch += (0.3 - world.cameraPitch) * Math.min(1, dt * 2)
    }

    const distance = driving ? 9 : 5
    const { cameraYaw: yaw, cameraPitch: pitch, focus } = world
    lookAt.set(focus.x, focus.y + (driving ? 1.2 : 0.8), focus.z)
    desired.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))

    // Pull the camera in if a building is between it and the target.
    const ray = new rapier.Ray(lookAt, desired)
    const exclude = driving ? world.car : world.player
    const hit = physics.castRay(ray, distance, true, undefined, undefined, undefined, exclude)
    const d = hit ? Math.max(1, hit.timeOfImpact - 0.3) : distance

    desired.multiplyScalar(d).add(lookAt)
    camera.position.lerp(desired, 1 - Math.exp(-12 * dt))
    camera.lookAt(lookAt)
  })

  return null
}
