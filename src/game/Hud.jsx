import { useEffect, useMemo, useRef, useState } from 'react'
import Radar from './Radar'
import { INTRO_LENGTH } from './CameraRig'
import { activeTarget, INTRO_CALL } from './quests'
import { blip, setMusic, startAudio } from './audio'
import TouchControls, { isTouch } from './TouchControls'
import { openDialogue, placeInRoom } from './GameLogic'
import { addChat, connectMultiplayer } from './net'
import { applySave, signedInName, signIn, startAutosave } from './save'
import { Decorate, Wardrobe } from './Panels'
import { Garage, Market, PropertySheet } from './ShopPanels'
import Phone, { PhoneAlerts } from './Phone'
import { phone } from './phoneline'
import { cleanOutfit, starterOutfit } from './wardrobe'
import { personalize } from './who'
import { useGame, world } from './state'
import './hud.css'

function useClock() {
  const [minutes, setMinutes] = useState(world.time)
  useEffect(() => {
    const id = setInterval(() => setMinutes(world.time), 250)
    return () => clearInterval(id)
  }, [])
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(Math.floor(minutes % 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

const NAME_KEY = 'eko-streets-name'
function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

const GENDER_KEY = 'eko-streets-gender'
function savedGender() {
  try {
    return localStorage.getItem(GENDER_KEY) === 'girl' ? 'girl' : 'boy'
  } catch {
    return 'boy'
  }
}

let starting = false
async function startGame() {
  if (useGame.getState().phase !== 'title' || starting) return
  // You play as yourself: no default name.
  const name = (document.getElementById('player-name')?.value ?? '').trim().slice(0, 16)
  if (name.length < 2) {
    useGame.setState({ signInError: 'Type the name you want to be called (at least 2 letters).' })
    document.getElementById('player-name')?.focus()
    return
  }
  const gender = useGame.getState().gender
  const pin = (document.getElementById('player-pin')?.value ?? '').trim()
  try {
    localStorage.setItem(NAME_KEY, name)
    localStorage.setItem(GENDER_KEY, gender)
  } catch {
    // Private windows can refuse storage; the name just won't be remembered.
  }
  // Sign in (or carry on as a guest) and load the save before anything starts.
  starting = true
  useGame.setState({ signInError: null, signingIn: true })
  let result
  try {
    result = await signIn(name, pin)
  } catch (err) {
    starting = false
    useGame.setState({ signInError: err.message, signingIn: false })
    return
  }
  starting = false
  useGame.setState({ signingIn: false })
  applySave(result.save)
  const returning = !!result.save
  // Boy or girl is whatever was picked just now (it can change between
  // games); clothes that don't suit the choice give way to a starter outfit.
  const kept = cleanOutfit(useGame.getState().outfit, gender)
  const fits = returning && JSON.stringify(kept) === JSON.stringify(useGame.getState().outfit) && useGame.getState().gender === gender
  useGame.setState({ gender, outfit: fits ? kept : starterOutfit(name, gender) })
  useGame.setState({ playerName: useGame.getState().account?.name ?? name })
  connectMultiplayer(useGame.getState().playerName)
  startAudio()
  setMusic(useGame.getState().music)
  startAutosave()
  world.introStart = performance.now() / 1000
  // You wake up at home; Mama has words for you (the first time).
  placeInRoom('home')
  world.time = 13 * 60
  useGame.setState({ phase: 'intro' })
  setTimeout(() => {
    if (!returning) return openDialogue(INTRO_CALL, () => useGame.setState({ phase: 'playing' }))
    useGame.setState({ phase: 'playing', message: { text: `WELCOME BACK\n${useGame.getState().playerName.toUpperCase()}`, color: '#ffd23a', key: Date.now() } })
    setTimeout(() => useGame.setState({ message: null }), 3000)
  }, INTRO_LENGTH * 1000)
}

// Boy or girl, before you start.
function GenderPicker() {
  const gender = useGame((s) => s.gender)
  useEffect(() => useGame.setState({ gender: savedGender() }), [])
  return (
    <div className="gender-pick" role="radiogroup" aria-label="Play as">
      {[
        ['boy', '👦🏾', 'Boy'],
        ['girl', '👧🏾', 'Girl'],
      ].map(([id, icon, label]) => (
        <button key={id} role="radio" aria-checked={gender === id} className={gender === id ? 'active' : ''} onClick={() => useGame.setState({ gender: id })}>
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  )
}

function Title() {
  const error = useGame((s) => s.signInError)
  const busy = useGame((s) => s.signingIn)
  const known = signedInName()
  useEffect(() => {
    const onKey = (e) => e.code === 'Enter' && startGame()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="title">
      <div className="title-card">
        <h1>
          EKO <span>STREETS</span>
        </h1>
        <p className="tagline">Lagos, Nigeria. Twenty million people. One city.</p>
        <GenderPicker />
        <div className="sign-in">
          <label className="name-field">
            Your name
            <input id="player-name" maxLength={16} defaultValue={known ?? savedName()} placeholder="Type your name" autoComplete="username" />
          </label>
          <label className="name-field pin">
            PIN
            <input id="player-pin" type="password" inputMode="numeric" maxLength={8} placeholder={known ? 'signed in' : '4 digits'} autoComplete="current-password" />
          </label>
        </div>
        <p className="save-hint">
          {known ? `Signed in as ${known}: your game saves online.` : 'Add a 4-digit PIN to save your game online and carry on from any phone or computer. A new name makes a new save.'}
        </p>
        {error && <p className="sign-error">{error}</p>}
        <button className="start" onClick={startGame} disabled={busy}>
          {busy ? 'Loading your game…' : isTouch ? 'Tap to start' : 'Press Enter to start'}
        </button>
      </div>
    </div>
  )
}

// A little cloud in the corner: "Saved" for a moment after each save, or a
// warning while the save server can't be reached.
function SaveBadge() {
  const status = useGame((s) => s.saveStatus)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (status !== 'saved') return
    setShow(true)
    const id = setTimeout(() => setShow(false), 1800)
    return () => clearTimeout(id)
  }, [status])
  if (status === 'offline') return <div className="save-badge warn">☁ Not saved (offline)</div>
  return show ? <div className="save-badge">☁ Saved</div> : null
}

function IntroCaptions() {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const a = setTimeout(() => setLine(1), 3200)
    const b = setTimeout(() => setLine(2), INTRO_LENGTH * 1000 - 300)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  const text = ['LAGOS, NIGERIA', 'EKO O NI BAJE', null][line]
  return text ? (
    <div className="intro-caption" key={line}>
      {text}
    </div>
  ) : null
}

const TYPE_MS = 22

function Dialogue({ dialogue }) {
  const { lines, index } = dialogue
  const raw = lines[index]
  // Lines can name the player or depend on boy/girl (who.js).
  const line = useMemo(() => ({ speaker: personalize(raw.speaker), text: personalize(raw.text) }), [raw])
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    shownRef.current = 0
    setShown(0)
    const id = setInterval(() => {
      shownRef.current = Math.min(line.text.length, shownRef.current + 1)
      setShown(shownRef.current)
      if (shownRef.current % 3 === 0) blip()
      if (shownRef.current >= line.text.length) clearInterval(id)
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [line])

  useEffect(() => {
    const advance = () => {
      if (shownRef.current < line.text.length) {
        shownRef.current = line.text.length
        setShown(line.text.length)
        return
      }
      if (index + 1 < lines.length) {
        useGame.setState({ dialogue: { ...dialogue, index: index + 1 } })
      } else {
        world.dialogueClosedAt = performance.now()
        useGame.setState({ dialogue: null })
        dialogue.onDone?.()
      }
    }
    const onKey = (e) => {
      if (['KeyE', 'Space', 'Enter'].includes(e.code)) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', advance)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', advance)
    }
  }, [dialogue, index, line, lines])

  return (
    <div className="dialogue">
      <div className="speaker">{line.speaker}</div>
      <p>{line.text.slice(0, shown)}</p>
      <div className="next">{shown >= line.text.length ? (index + 1 < lines.length ? 'E ▸' : 'E ✓') : ''}</div>
    </div>
  )
}

function Chat({ chat, open }) {
  const input = useRef()
  const [, tick] = useState(0)
  // Re-render now and then so old messages fade away.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  const close = () => useGame.setState({ chatOpen: false })
  const onKey = (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') close()
    if (e.key === 'Enter') {
      const text = e.currentTarget.value.trim()
      if (text) world.net?.chat(text)
      if (text && !world.net) addChat(null, 'You are offline, so nobody can hear you.', true)
      close()
    }
  }
  const visible = chat.filter((c) => open || Date.now() - c.at < 12000)
  return (
    <div className="chat">
      {visible.map((c) => (
        <div key={c.key} className={c.system ? 'system' : ''}>
          {c.name && <b>{c.name}: </b>}
          {c.text}
        </div>
      ))}
      {open && <input ref={input} maxLength={120} placeholder="Say something, then press Enter" onKeyDown={onKey} onKeyUp={(e) => e.stopPropagation()} />}
    </div>
  )
}

function RacePanel({ race }) {
  const time = `${Math.floor(race.time / 60)}:${(race.time % 60).toFixed(1).padStart(4, '0')}`
  let text
  if (race.phase === 'lobby' && race.joined) text = `${race.name} starts in ${race.left}s · ${race.racers} racer${race.racers > 1 ? 's' : ''}`
  else if (race.phase === 'lobby') text = `${race.host ?? 'Someone'} started the ${race.name}! ${race.left}s to join: get to the flag on the Island`
  else if (race.phase === 'grid') text = `${race.name}: get ready…`
  else if (race.phase === 'running') text = `CHECKPOINT ${race.cp}/${race.count} · ${time}`
  else text = `${race.name}: finished ${time}`
  return (
    <div className="race-panel">
      <span>🏁 RACE</span>
      {text}
    </div>
  )
}

// Steady while the police can see you; blinking while you're out of sight
// and getting away.
function Stars({ wanted, evading }) {
  return (
    <div className={`stars ${wanted > 0 ? 'active' : ''} ${evading ? 'evading' : ''}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < wanted ? 'on' : ''}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function Hud() {
  const game = useGame()
  const clock = useClock()
  const [showHelp, setShowHelp] = useState(true)

  useEffect(() => {
    const onKey = (e) => e.code === 'KeyH' && !(e.target instanceof HTMLInputElement) && setShowHelp((s) => !s)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // The controls box tidies itself away once you're moving, or after a while
  // (H brings it back).
  const playingNow = game.phase === 'playing'
  useEffect(() => {
    if (!playingNow) return
    // Only once: after that, H alone shows and hides it.
    const onMove = (e) => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && hide()
    const hide = () => {
      setShowHelp(false)
      window.removeEventListener('keydown', onMove)
      clearTimeout(id)
    }
    const id = setTimeout(hide, 20000)
    window.addEventListener('keydown', onMove)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onMove)
    }
  }, [playingNow])

  if (game.phase === 'title') return <Title />

  const target = activeTarget(game)
  const playing = game.phase === 'playing'

  return (
    <div className={`hud ${isTouch ? 'is-touch' : ''}`}>
      {game.phase === 'intro' && !game.dialogue && <IntroCaptions />}

      {playing && (
        <>
          <div className="top-right">
            <div className="clock">{clock}</div>
            <div className="bar">
              <div className="fill health" style={{ width: `${game.health}%` }} />
            </div>
            <div className="money">₦{String(game.money).padStart(8, '0')}</div>
            <Stars wanted={game.wanted} evading={game.evading} />
            <SaveBadge />
          </div>

          {game.race && game.race.phase !== 'watching' && !game.dialogue && <RacePanel race={game.race} />}
          {target && !game.dialogue && !(game.race && ['grid', 'running'].includes(game.race.phase)) && (
            <div className={`objective ${game.sideJob ? 'side' : ''}`}>
              <span>{game.sideJob ? 'SIDE JOB' : 'NEXT UP'}</span>
              {personalize(target.objective)}
              {game.timer != null && <b className={`timer ${game.timer <= 10 ? 'low' : ''}`}>⏱ {game.timer}s</b>}
            </div>
          )}

          {(game.prompt || (showHelp && !isTouch)) && !game.dialogue && (
            <div className="help">
              {personalize(game.prompt) ?? (
                <>
                  Click to look around. <b>WASD</b> move, <b>Shift</b> run, <b>Click</b>/<b>X</b> punch, <b>E</b> talk, <b>F</b> get in or jack a car,
                  <b>Q</b> horn. Follow the yellow marker on the radar. <b>H</b> hides this.
                </>
              )}
            </div>
          )}

          {game.banner && (
            <div className="banner" key={`banner${game.banner.key}`}>
              {personalize(game.banner.text)}
            </div>
          )}
          {game.mode === 'car' && (
            <div className="speed">
              {game.speed} km/h
              <div className="bar car-bar">
                <div className="fill" style={{ width: `${Math.max(0, game.carHp ?? 100)}%`, background: (game.carHp ?? 100) < 30 ? '#e8343a' : '#f2b705' }} />
              </div>
            </div>
          )}
          {game.hurt > 0 && <div className="hurt" key={`hurt${game.hurt}`} />}
          <Chat chat={game.chat} open={game.chatOpen} />
          {game.online && (
            <div className="online">
              ● ONLINE · {game.players}
              {game.players > 1 && <span className="meet">{isTouch ? ' · tap 👥 to meet up' : ' · press G to meet up'}</span>}
            </div>
          )}
          {game.subtitle && !game.dialogue && (
            <div className="subtitle">
              <b>{personalize(game.subtitle.speaker)}:</b> {personalize(game.subtitle.text)}
            </div>
          )}
          {!game.inside && <Radar />}
          {isTouch && !game.dialogue && !game.panel && <TouchControls />}
          {game.hold && (
            <div className="hold">
              <span>FILLING THE BAG</span>
              <div className="bar">
                <div className="fill" style={{ width: `${game.hold.progress * 100}%`, background: '#7ee07e' }} />
              </div>
            </div>
          )}
        </>
      )}
      <div className={`fade ${game.fade ? 'on' : ''}`} />

      {game.message && (
        <div className="message" key={`message${game.message.key}`} style={{ color: game.message.color }}>
          {personalize(game.message.text)}
        </div>
      )}
      {game.dialogue && <Dialogue dialogue={game.dialogue} />}
      {game.panel === 'wardrobe' && <Wardrobe />}
      {game.panel === 'decor' && <Decorate />}
      {game.panel === 'phone' && <Phone />}
      {game.panel === 'market' && <Market />}
      {game.panel === 'property' && <PropertySheet />}
      {game.panel === 'garage' && <Garage />}
      {game.phase === 'playing' && <PhoneAlerts />}
      {game.phase === 'playing' && !isTouch && !game.panel && (
        <button className="phone-btn" onClick={() => phone.open()}>
          📱 <kbd>P</kbd>
          {game.unread > 0 && <span className="badge">{game.unread}</span>}
        </button>
      )}
    </div>
  )
}
