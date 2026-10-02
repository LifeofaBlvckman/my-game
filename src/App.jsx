import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import City from './game/City'
import Landmarks from './game/Landmarks'
import TrafficLights from './game/TrafficLights'
import Traffic from './game/Traffic'
import Pedestrians from './game/Pedestrians'
import NamedNpcs from './game/NamedNpcs'
import Player from './game/Player'
import Car from './game/Car'
import CameraRig from './game/CameraRig'
import GameLogic from './game/GameLogic'
import DayNight from './game/DayNight'
import InkOutlines from './game/InkOutlines'
import Hud from './game/Hud'
import { keyMap } from './game/controls'
import { useGame } from './game/state'

// Lower resolution reads as retro and keeps an older laptop GPU comfortable.
// Raise toward 1 (or window.devicePixelRatio) for a sharper image.
const RENDER_SCALE = 0.6

export default function App() {
  const outlines = useGame((s) => s.outlines)
  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        flat
        dpr={RENDER_SCALE}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: 65, near: 0.1, far: 300, position: [150, 70, 150] }}
      >
        <DayNight />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <City />
            <Landmarks />
            <TrafficLights />
            <Traffic />
            <Pedestrians />
            <NamedNpcs />
            <Player />
            <Car />
            <CameraRig />
            <GameLogic />
          </Physics>
        </Suspense>
        {outlines && <InkOutlines />}
      </Canvas>
      <Hud />
    </KeyboardControls>
  )
}
