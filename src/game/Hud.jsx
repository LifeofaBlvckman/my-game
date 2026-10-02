import { useEffect, useState } from 'react'
import Radar from './Radar'
import { useGame } from './state'
import './hud.css'

// In-game clock: one game minute per real second, like San Andreas.
function useGameClock(start = 8 * 60) {
  const [minutes, setMinutes] = useState(start)
  useEffect(() => {
    const id = setInterval(() => setMinutes((m) => (m + 1) % (24 * 60)), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function Hud() {
  const { mode, speed, nearCar } = useGame()
  const clock = useGameClock()
  const [showHelp, setShowHelp] = useState(true)

  useEffect(() => {
    const onKey = (e) => e.code === 'KeyH' && setShowHelp((s) => !s)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hud">
      <div className="top-right">
        <div className="clock">{clock}</div>
        <div className="bar health" />
        <div className="money">$00000000</div>
      </div>

      {(nearCar || showHelp) && (
        <div className="help">
          {nearCar ? (
            <>
              Press <b>F</b> to enter the vehicle.
            </>
          ) : (
            <>
              Click to look around with the mouse. <b>WASD</b> move, <b>Shift</b> run, <b>Space</b> jump.
              Walk up to the car and press <b>F</b>. In the car, <b>Space</b> is the handbrake. <b>H</b> hides this.
            </>
          )}
        </div>
      )}

      {mode === 'car' && <div className="speed">{speed} km/h</div>}

      <Radar />
    </div>
  )
}
