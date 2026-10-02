import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import City from './game/City'
import Player from './game/Player'
import Car from './game/Car'
import CameraRig from './game/CameraRig'
import GameLogic from './game/GameLogic'
import Hud from './game/Hud'
import { keyMap } from './game/controls'

// Lower resolution reads as retro and keeps an older laptop GPU comfortable.
// Raise toward 1 (or window.devicePixelRatio) for a sharper image.
const RENDER_SCALE = 0.6

export default function App() {
  return (
    <KeyboardControls map={keyMap}>
      <Canvas dpr={RENDER_SCALE} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 65, near: 0.1, far: 320 }}>
        {/* Smoggy orange haze with a short draw distance, PS2 style */}
        <color attach="background" args={['#e6b98f']} />
        <fog attach="fog" args={['#e6b98f', 70, 300]} />
        <hemisphereLight args={['#ffe6c7', '#6e5b45', 1.6]} />
        <directionalLight position={[80, 120, 40]} intensity={1.8} color="#ffd9a8" />

        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <City />
            <Player />
            <Car />
            <CameraRig />
            <GameLogic />
          </Physics>
        </Suspense>
      </Canvas>
      <Hud />
    </KeyboardControls>
  )
}
