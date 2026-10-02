import { useEffect, useRef, useState } from 'react'
import Radar from './Radar'
import { INTRO_LENGTH } from './CameraRig'
import { currentTarget, INTRO_CALL } from './quests'
import { blip, setMusic, startAudio } from './audio'
import { openDialogue } from './GameLogic'
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

function startGame() {
  if (useGame.getState().phase !== 'title') return
  startAudio()
  setMusic(useGame.getState().music)
  world.introStart = performance.now() / 1000
  useGame.setState({ phase: 'intro' })
  setTimeout(() => openDialogue(INTRO_CALL, () => useGame.setState({ phase: 'playing' })), INTRO_LENGTH * 1000)
}

function Title() {
  useEffect(() => {
    const onKey = (e) => e.code === 'Enter' && startGame()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="title" onClick={startGame}>
      <div className="title-card">
        <h1>
          EKO <span>STREETS</span>
        </h1>
        <p className="tagline">Lagos, Nigeria. Twenty million people. One city.</p>
        <button className="start">Press Enter or click to start</button>
        <ul className="keys">
          <li>
            <b>WASD</b> move · <b>Shift</b> run · <b>Space</b> jump / handbrake
          </li>
          <li>
            <b>E</b> talk · <b>F</b> enter, exit or jack a car · <b>Q</b> horn
          </li>
          <li>
            <b>M</b> music · <b>O</b> outlines · <b>T</b> skip an hour · <b>H</b> help
          </li>
        </ul>
      </div>
    </div>
  )
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
  const line = lines[index]
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

function Stars({ wanted }) {
  return (
    <div className={`stars ${wanted > 0 ? 'active' : ''}`}>
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
    const onKey = (e) => e.code === 'KeyH' && setShowHelp((s) => !s)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (game.phase === 'title') return <Title />

  const target = currentTarget(game.quest, game.step)
  const playing = game.phase === 'playing'

  return (
    <div className="hud">
      {game.phase === 'intro' && !game.dialogue && <IntroCaptions />}

      {playing && (
        <>
          <div className="top-right">
            <div className="clock">{clock}</div>
            <div className="bar health" />
            <div className="money">₦{String(game.money).padStart(8, '0')}</div>
            <Stars wanted={game.wanted} />
          </div>

          {target && !game.dialogue && (
            <div className="objective">
              <span>NEXT UP</span>
              {target.objective}
            </div>
          )}

          {(game.prompt || showHelp) && !game.dialogue && (
            <div className="help">
              {game.prompt ?? (
                <>
                  Click to look around. <b>WASD</b> move, <b>Shift</b> run, <b>E</b> talk, <b>F</b> get in or jack a car, <b>Q</b> horn.
                  Follow the yellow marker on the radar. <b>H</b> hides this.
                </>
              )}
            </div>
          )}

          {game.banner && (
            <div className="banner" key={game.banner.key}>
              {game.banner.text}
            </div>
          )}
          {game.mode === 'car' && <div className="speed">{game.speed} km/h</div>}
          {game.subtitle && !game.dialogue && (
            <div className="subtitle">
              <b>{game.subtitle.speaker}:</b> {game.subtitle.text}
            </div>
          )}
          <Radar />
        </>
      )}

      {game.message && (
        <div className="message" key={game.message.key} style={{ color: game.message.color }}>
          {game.message.text}
        </div>
      )}
      {game.dialogue && <Dialogue dialogue={game.dialogue} />}
    </div>
  )
}
