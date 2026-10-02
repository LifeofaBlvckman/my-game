import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useGame, world } from './state'

const ENTER_DISTANCE = 4

function distanceToCar() {
  const p = world.player.translation()
  const c = world.car.translation()
  return Math.hypot(p.x - c.x, p.z - c.z)
}

// Getting in and out of the car, plus feeding the HUD.
export default function GameLogic() {
  const [subscribeKeys] = useKeyboardControls()
  const hudTimer = useRef(0)

  useEffect(
    () =>
      subscribeKeys(
        (s) => s.enter,
        (pressed) => {
          if (!pressed || !world.player || !world.car) return
          const { mode, setMode } = useGame.getState()

          if (mode === 'foot' && distanceToCar() < ENTER_DISTANCE) {
            world.player.setEnabled(false)
            setMode('car')
          } else if (mode === 'car') {
            // Step out on the driver's side (the car's left).
            const c = world.car.translation()
            const left = world.heading + Math.PI / 2
            world.player.setTranslation({ x: c.x + Math.sin(left) * 2, y: c.y + 0.6, z: c.z + Math.cos(left) * 2 }, true)
            world.player.setLinvel({ x: 0, y: 0, z: 0 }, true)
            world.player.setEnabled(true)
            world.carSpeed = 0
            setMode('foot')
          }
        },
      ),
    [subscribeKeys],
  )

  useFrame((_, dt) => {
    if (!world.player || !world.car) return
    hudTimer.current += dt
    if (hudTimer.current < 0.1) return
    hudTimer.current = 0

    const game = useGame.getState()
    const near = game.mode === 'foot' && distanceToCar() < ENTER_DISTANCE
    if (near !== game.nearCar) game.setNearCar(near)
    const kmh = Math.round((world.carSpeed ?? 0) * 3.6)
    if (kmh !== game.speed) game.setSpeed(kmh)
  })

  return null
}
