import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, PerformanceMonitor } from '@react-three/drei'
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
import Effects from './game/Effects'
import RemotePlayers from './game/RemotePlayers'
import ShadowCasters from './game/ShadowCasters'
import Interiors from './game/Interiors'
import Hud from './game/Hud'
import { keyMap } from './game/controls'
import { useGame } from './game/state'

// Rendering resolution. Starts sharp and drops automatically if the frame
// rate struggles, which keeps an older laptop GPU comfortable.
const RENDER_SCALE = { high: 1, low: 0.65 }

export default function App() {
  const outlines = useGame((s) => s.outlines)
  const [dpr, setDpr] = useState(RENDER_SCALE.high)
  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        flat
        shadows="percentage"
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: 65, near: 0.1, far: 620, position: [150, 70, 150] }}
      >
        <PerformanceMonitor
          onDecline={() => {
            // Struggling: drop resolution and real shadows (blob shadows stay).
            setDpr(RENDER_SCALE.low)
            useGame.setState({ shadows: false })
          }}
          onIncline={() => setDpr(RENDER_SCALE.high)}
        />
        <ShadowCasters />
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
            <Interiors />
            <RemotePlayers />
            <Effects />
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
