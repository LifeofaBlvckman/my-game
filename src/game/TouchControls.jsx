import { useEffect, useRef, useState } from 'react'
import { EMOTES, emote } from './emotes'
import { useGame, world } from './state'

// On-screen controls for phones and tablets. They press the same keys the
// keyboard would, so the rest of the game doesn't need to know:
//  - left thumb: a joystick (W A S D; pushed all the way it sprints)
//  - right thumb: drag anywhere to look around
//  - buttons: punch, jump/handbrake, talk/door, car, horn, emoji
export const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

const held = new Set()
function key(code, down) {
  if (down === held.has(code)) return
  if (down) held.add(code)
  else held.delete(code)
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }))
}

const STICK = 56 // px from the center to the edge of the stick's travel

function Joystick() {
  const [knob, setKnob] = useState(null) // { x, y, cx, cy } in px
  const pointer = useRef(null)
  const update = (e) => {
    const { cx, cy } = pointer.current
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const d = Math.hypot(dx, dy)
    if (d > STICK) {
      dx *= STICK / d
      dy *= STICK / d
    }
    const nx = dx / STICK
    const ny = dy / STICK
    key('KeyW', ny < -0.35)
    key('KeyS', ny > 0.35)
    key('KeyA', nx < -0.35)
    key('KeyD', nx > 0.35)
    key('ShiftLeft', d > STICK * 0.95 && useGame.getState().mode === 'foot')
    setKnob({ x: dx, y: dy, cx, cy })
  }
  const release = () => {
    pointer.current = null
    ;['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft'].forEach((c) => key(c, false))
    setKnob(null)
  }
  return (
    <div
      className="stick-zone"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointer.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY }
        update(e)
      }}
      onPointerMove={(e) => pointer.current?.id === e.pointerId && update(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {knob ? (
        <div className="stick" style={{ left: knob.cx, top: knob.cy }}>
          <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : (
        <div className="stick idle">
          <div className="knob" />
        </div>
      )}
    </div>
  )
}

// Drag on the right half of the screen to turn the camera.
function LookZone() {
  const last = useRef(null)
  return (
    <div
      className="look-zone"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      }}
      onPointerMove={(e) => {
        const l = last.current
        if (!l || l.id !== e.pointerId) return
        world.cameraYaw -= (e.clientX - l.x) * 0.006
        world.cameraPitch = Math.min(1.2, Math.max(-0.1, world.cameraPitch + (e.clientY - l.y) * 0.005))
        world.lastMouseMove = performance.now()
        l.x = e.clientX
        l.y = e.clientY
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  )
}

function Button({ code, label, className = '' }) {
  return (
    <button
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        key(code, true)
      }}
      onPointerUp={() => key(code, false)}
      onPointerCancel={() => key(code, false)}
      onPointerLeave={() => key(code, false)}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </button>
  )
}

function EmojiPicker() {
  const [open, setOpen] = useState(false)
  return (
    <div className="emoji-picker">
      {open && (
        <div className="emoji-list">
          {EMOTES.map((e, i) => (
            <button
              key={i}
              onPointerDown={(ev) => {
                ev.stopPropagation()
                emote(i)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button className="touch-btn small" onPointerDown={(e) => (e.stopPropagation(), setOpen((o) => !o))}>
        😀
      </button>
    </div>
  )
}

export default function TouchControls() {
  const mode = useGame((s) => s.mode)
  const prompt = useGame((s) => s.prompt)
  const online = useGame((s) => s.online)
  // Let go of everything if the page is hidden mid-press.
  useEffect(() => {
    const off = () => [...held].forEach((c) => key(c, false))
    window.addEventListener('blur', off)
    return () => {
      // Hidden (a dialogue opened, or the game ended): release everything.
      window.removeEventListener('blur', off)
      off()
    }
  }, [])
  const car = mode === 'car'
  return (
    <div className="touch">
      <LookZone />
      <Joystick />
      <div className="touch-buttons">
        {!car && <Button code="KeyX" label="👊" className="big" />}
        {car && <Button code="KeyQ" label="📯" className="big" />}
        <Button code="Space" label={car ? 'BRAKE' : 'JUMP'} />
        <Button code="KeyF" label="CAR" />
        {prompt && <Button code="KeyE" label="E" className="glow" />}
      </div>
      <div className="touch-top">
        <EmojiPicker />
        {online && <Button code="KeyY" label="💬" className="small" />}
        <Button code="KeyM" label="♪" className="small" />
      </div>
    </div>
  )
}
