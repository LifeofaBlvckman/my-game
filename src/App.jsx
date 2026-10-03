import { Suspense, useRef, useState } from 'react'
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
import Birds from './game/Birds'
import { keyMap } from './game/controls'
import { useGame } from './game/state'

// Rendering resolution, as steps from sharpest to cheapest. It starts at the
// screen's own sharpness (up to 1.5x on Retina screens) and steps down if
// the frame rate struggles. Real shadows go first, before it drops below one
// pixel per screen point, so the picture stays sharp on an older laptop.
// Phones get a lighter start: their screens are dense but their GPUs are small.
const PHONE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const DEVICE_SCALE = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, PHONE ? 1.25 : 1.5)
const RENDER_STEPS = [...new Set([DEVICE_SCALE, 1.25, 1, 0.85].filter((v) => v <= DEVICE_SCALE))]

export default function App() {
  const outlines = useGame((s) => s.outlines)
  const [step, setStep] = useState(0)
  const stepRef = useRef(0)
  stepRef.current = step
  const dpr = RENDER_STEPS[step]
  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        flat
        shadows="percentage"
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: 65, near: 0.25, far: 620, position: [150, 70, 150] }}
      >
        <PerformanceMonitor
          flipflops={4}
          onDecline={() => {
            // Struggling: drop real shadows (blob shadows stay) once at 1x,
            // then the last step of resolution.
            const next = Math.min(stepRef.current + 1, RENDER_STEPS.length - 1)
            if (RENDER_STEPS[next] < 1 && useGame.getState().shadows) useGame.setState({ shadows: false })
            else setStep(next)
          }}
          onIncline={() => setStep((k) => Math.max(0, k - 1))}
          onFallback={() => {
            useGame.setState({ shadows: false })
            setStep(RENDER_STEPS.indexOf(1))
          }}
        />
        <ShadowCasters />
        <DayNight />
        <Birds />
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
