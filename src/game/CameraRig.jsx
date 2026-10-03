import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Vector3 } from 'three'
import { useGame, world } from './state'
import { shake } from './particles'

const desired = new Vector3()
const lookAt = new Vector3()
const from = new Vector3()

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
export const INTRO_LENGTH = 1.5 // seconds before Mama starts talking

// Third-person orbit camera. Click the game to capture the mouse, Esc to release.
// On the title screen it circles the city; during the intro it swoops down to Tunde.
export default function CameraRig() {
  const { camera, gl } = useThree()
  const { rapier, world: physics } = useRapier()

  useEffect(() => {
    const canvas = gl.domElement
    const lock = () => useGame.getState().phase === 'playing' && canvas.requestPointerLock?.()
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

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const game = useGame.getState()

    if (game.phase === 'title') {
      const t = clock.elapsedTime * 0.05
      camera.position.set(Math.sin(t) * 150, 70, Math.cos(t) * 150)
      camera.lookAt(0, 10, 0)
      return
    }

    const driving = game.mode === 'car'
    const distance = driving ? 9 : 5
    const { focus } = world
    lookAt.set(focus.x, focus.y + (driving ? 1.2 : 0.8), focus.z)

    // While driving, swing back behind the car once the mouse has been idle.
    // On foot, do the same more gently after a few seconds.
    const idle = performance.now() - world.lastMouseMove
    if ((driving && idle > 1200) || (!driving && idle > 4000 && game.phase === 'playing')) {
      const behind = world.heading + Math.PI
      const rate = driving ? 2.5 : 0.6
      world.cameraYaw += wrapAngle(behind - world.cameraYaw) * Math.min(1, dt * rate)
      world.cameraPitch += ((driving ? 0.3 : 0.35) - world.cameraPitch) * Math.min(1, dt * 2)
    }

    const { cameraYaw: yaw, cameraPitch: pitch } = world
    desired.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))

    // Pull the camera in if a building is between it and the target.
    const ray = new rapier.Ray(lookAt, desired)
    const exclude = driving ? world.car : world.player
    const hit = physics.castRay(ray, distance, true, undefined, undefined, undefined, exclude, (c) => !world.trafficColliders.has(c.handle))
    // Never push through the wall: in a tight spot the camera comes in close
    // and rises to look over the shoulder instead.
    const d = hit ? Math.max(0.5, hit.timeOfImpact - 0.3) : distance
    desired.multiplyScalar(d).add(lookAt)
    if (d < 1.8) desired.y += (1.8 - d) * 0.6

    if (game.phase === 'intro' && !game.inside) {
      // Swoop from high over Victoria Island down to the usual follow position.
      const k = Math.min(1, (performance.now() / 1000 - world.introStart) / INTRO_LENGTH)
      const e = 1 - Math.pow(1 - k, 3)
      from.set(lookAt.x + 90, 85, lookAt.z + 120)
      camera.position.lerpVectors(from, desired, e)
      camera.lookAt(lookAt)
      return
    }

    camera.position.lerp(desired, 1 - Math.exp(-12 * dt))
    camera.lookAt(lookAt)

    // Screen shake from hits, crashes and explosions.
    if (shake.amount > 0.001) {
      const k = shake.amount * 0.35
      camera.position.x += (Math.random() - 0.5) * k
      camera.position.y += (Math.random() - 0.5) * k
      camera.position.z += (Math.random() - 0.5) * k
      shake.amount *= Math.exp(-7 * dt)
    }
  })

  return null
}
