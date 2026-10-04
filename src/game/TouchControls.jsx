import { useEffect, useRef, useState } from 'react'
import { EMOTES, emote } from './emotes'
import { useGame, world } from './state'
import { phone } from './phoneline'
import { personalize } from './who'

// On-screen controls for phones and tablets, kept as quiet as Messenger's:
//  - left half: put a thumb down anywhere and drag to move (the stick only
//    shows while you're touching; push it all the way to sprint)
//  - right half: drag to look around
//  - one big action button that becomes whatever makes sense right now
//    (talk, enter, drive, eat, race... or punch), and a small jump button
//  - square buttons: ☰ for the rest (friends, chat, music, help), 😀 and 📱
//  - in a car: the same left-thumb stick drives: drag the way you want to go
//    (up to go, to a side to turn, back to brake and reverse)
// They press the same keys the keyboard would, so the game doesn't need to know.
export const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

const held = new Set()
function key(code, down) {
  if (down === held.has(code)) return
  if (down) held.add(code)
  else held.delete(code)
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }))
}
const tap = (code) => {
  key(code, true)
  setTimeout(() => key(code, false), 80)
}

const STICK = 52 // px from the center to the edge of the stick's travel

function MoveZone({ hint }) {
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
    // The car reads the stick directly, for smooth steering and throttle;
    // on foot it presses the movement keys.
    world.stick = { x: nx, y: ny }
    const foot = useGame.getState().mode === 'foot'
    key('KeyW', foot && ny < -0.35)
    key('KeyS', foot && ny > 0.35)
    key('KeyA', foot && nx < -0.35)
    key('KeyD', foot && nx > 0.35)
    key('ShiftLeft', foot && d > STICK * 0.95)
    setKnob({ x: dx, y: dy, cx, cy })
  }
  const release = () => {
    pointer.current = null
    world.stick = null
    ;['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft'].forEach((c) => key(c, false))
    setKnob(null)
  }
  // Leaving the screen (a dialogue, the end of the game): let go of
  // everything the stick was holding, or the car would set off by itself.
  useEffect(() => () => {
    world.stick = null
    ;['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft'].forEach((c) => key(c, false))
  }, [])
  return (
    <div
      className="move-zone"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointer.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY }
        update(e)
      }}
      onPointerMove={(e) => pointer.current?.id === e.pointerId && update(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {knob && (
        <div className="stick" style={{ left: knob.cx, top: knob.cy }}>
          <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      )}
      {!knob && hint && <div className="stick-hint">{hint}</div>}
    </div>
  )
}

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

// A round button that holds its key down while pressed.
function HoldButton({ code, icon, label, className = '' }) {
  const up = () => key(code, false)
  return (
    <button
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        key(code, true)
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="icon">{icon}</span>
      {label && <span className="label">{label}</span>}
    </button>
  )
}

// Messenger-style square icon button.
function Square({ icon, onPress, active, badge }) {
  return (
    <button
      className={`sq-btn ${active ? 'active' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onPress()
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {icon}
      {badge > 0 && <span className="badge">{badge}</span>}
    </button>
  )
}

function EmojiGrid({ onDone }) {
  return (
    <div className="emoji-grid" onPointerDown={(e) => e.stopPropagation()}>
      {EMOTES.map((e, i) => (
        <button
          key={i}
          onPointerDown={(ev) => {
            ev.stopPropagation()
            emote(i)
            onDone()
          }}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

const MUSIC_LABEL = { calm: 'Calm', afro: 'Afrobeats', off: 'Off' }

function Menu({ onClose }) {
  const online = useGame((s) => s.online)
  const players = useGame((s) => s.players)
  const music = useGame((s) => s.music)
  const [help, setHelp] = useState(false)
  const item = (icon, text, fn, disabled) => (
    <button
      className="menu-item"
      disabled={disabled}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (disabled) return
        fn()
      }}
    >
      <span>{icon}</span>
      {text}
    </button>
  )
  return (
    <div className="menu-sheet" onPointerDown={(e) => e.stopPropagation()}>
      <div className="menu-title">{online ? `Online · ${players} player${players > 1 ? 's' : ''}` : 'Offline'}</div>
      {item('👥', 'Go to a friend', () => (tap('KeyG'), onClose()), !online || players < 2)}
      {item('💬', 'Chat', () => (tap('KeyY'), onClose()), !online)}
      {item('♪', `Music: ${MUSIC_LABEL[music] ?? music}`, () => tap('KeyM'))}
      {item('❓', 'How to play', () => setHelp((h) => !h))}
      {help && (
        <p className="menu-help">
          Left thumb: move (push far to sprint); in a car, drag the way you want to drive, and pull back to brake or reverse. Right thumb: look. The big button does whatever is nearby: talk, enter, drive, eat, race. Otherwise it punches. Follow the yellow dot on the radar; pink dots are friends.
        </p>
      )}
      {item('✕', 'Close', onClose)}
    </div>
  )
}

export default function TouchControls() {
  const mode = useGame((s) => s.mode)
  const action = useGame((s) => s.action)
  const prompt = useGame((s) => s.prompt)
  const unread = useGame((s) => s.unread)
  const [panel, setPanel] = useState(null) // 'menu' | 'emoji' | null
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
  // The big button: what's nearby, else punch (on foot) or the horn (driving).
  const main = action ?? (car ? { key: 'KeyQ', icon: '📯', label: 'Horn' } : { key: 'KeyX', icon: '👊', label: '' })
  // Say what the button will do ("talk to Mama Nkechi"), or show a hint.
  const bare = personalize(prompt)?.replace(/^Press [EF] to /, '')
  const caption = bare ? bare[0].toUpperCase() + bare.slice(1) : null
  return (
    <div className="touch">
      <LookZone />
      <MoveZone hint={car ? 'Drag to drive' : null} />
      <div className="touch-side">
        <Square icon="☰" active={panel === 'menu'} onPress={() => setPanel((p) => (p === 'menu' ? null : 'menu'))} />
        <Square icon="😀" active={panel === 'emoji'} onPress={() => setPanel((p) => (p === 'emoji' ? null : 'emoji'))} />
        <Square icon="📱" badge={unread} onPress={() => (setPanel(null), phone.open())} />
      </div>
      {panel === 'menu' && <Menu onClose={() => setPanel(null)} />}
      {panel === 'emoji' && <EmojiGrid onDone={() => setPanel(null)} />}
      <div className="touch-actions">
        {caption && <div className="action-caption">{caption}</div>}
        {car ? (
          // Driving: get out, the horn (or whatever's nearby), and the handbrake.
          <>
            <HoldButton key={main.key + main.icon} code={main.key} icon={main.icon} label={main.label} className={`big ${action ? 'glow' : ''}`} />
            <HoldButton code="KeyF" icon="🚪" className="small" />
            <HoldButton code="Space" icon="Ⓗ" className="small" />
          </>
        ) : (
          <>
            <HoldButton key={main.key + main.icon} code={main.key} icon={main.icon} label={main.label} className={`big ${action ? 'glow' : ''}`} />
            <HoldButton code="Space" icon="⤴" className="small" />
          </>
        )}
      </div>
    </div>
  )
}

