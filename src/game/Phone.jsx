import { useEffect, useRef, useState } from 'react'
import { phone } from './phoneline'
import { useGame, world } from './state'

// The phone screen (P, or 📱 on a phone): your contacts are everyone online;
// text them, call them, or send them where you are.

const close = () => useGame.setState({ panel: null })

function useClock() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const m = world.time
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`
}

const since = (t) => {
  const s = Math.floor((Date.now() - t) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Contacts() {
  const contacts = useGame((s) => s.contacts)
  const threads = useGame((s) => s.threads)
  const online = useGame((s) => s.online)
  // Anyone you've texted stays on the list, even after they go offline.
  const ids = new Set(contacts.map((c) => c.id))
  const past = Object.entries(threads)
    .filter(([id]) => !ids.has(Number(id)))
    .map(([id, t]) => ({ id: Number(id), name: t.name, gone: true }))
  const list = [...contacts, ...past]
  if (!online) return <p className="phone-empty">No network. You're playing offline, so there's nobody to call.</p>
  if (!list.length) return <p className="phone-empty">Nobody else is online right now. Send friends the game link, then text or call them here.</p>
  return (
    <ul className="contacts">
      {list.map((c) => (
        <li key={c.id}>
          <button className="contact" onClick={() => phone.view(c.id)}>
            <span className="avatar">{c.name[0]?.toUpperCase()}</span>
            <span className="contact-name">
              {c.name}
              <small>{c.gone ? 'offline' : c.here ? 'in your part of Lagos' : 'online'}</small>
            </span>
          </button>
          {!c.gone && (
            <>
              <button className="ph-icon" onClick={() => phone.call(c.id, c.name)} aria-label={`Call ${c.name}`}>
                📞
              </button>
              <button className="ph-icon" onClick={() => phone.pin(c.id, c.name)} aria-label={`Send ${c.name} your location`}>
                📍
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function Thread({ id }) {
  const thread = useGame((s) => s.threads[id])
  const contact = useGame((s) => s.contacts.find((c) => c.id === id))
  const call = useGame((s) => s.call)
  const name = contact?.name ?? thread?.name ?? 'Friend'
  const [text, setText] = useState('')
  const list = useRef()
  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight)
  }, [thread?.msgs.length])
  const send = () => {
    phone.text(id, name, text)
    setText('')
  }
  return (
    <div className="thread">
      <div className="thread-head">
        <button className="ph-back" onClick={() => useGame.setState({ phoneView: null })} aria-label="Back">
          ‹
        </button>
        <b>{name}</b>
        {contact && !call && (
          <button className="ph-icon" onClick={() => phone.call(id, name)} aria-label="Call">
            📞
          </button>
        )}
        {contact && (
          <button className="ph-icon" onClick={() => phone.pin(id, name)} aria-label="Send my location">
            📍
          </button>
        )}
      </div>
      <div className="msgs" ref={list}>
        {!thread?.msgs.length && <p className="phone-empty">Say hello to {name}.</p>}
        {thread?.msgs.map((m, i) => (
          <div key={i} className={`msg ${m.system ? 'sys' : m.me ? 'me' : 'them'}`}>
            {m.text}
          </div>
        ))}
      </div>
      {contact ? (
        <div className="compose">
          <input
            value={text}
            maxLength={200}
            placeholder={call?.state === 'on' && call.id === id ? 'Say something…' : 'Text message'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Typing shouldn't drive the game.
              e.stopPropagation()
              if (e.key === 'Enter') send()
              if (e.key === 'Escape') close()
            }}
          />
          <button onClick={send} aria-label="Send">
            ➤
          </button>
        </div>
      ) : (
        <p className="phone-empty">{name} is offline.</p>
      )}
    </div>
  )
}

function CallScreen({ call }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="call-screen">
      <span className="avatar big">{call.name[0]?.toUpperCase()}</span>
      <b>{call.name}</b>
      <span>{call.state === 'ringing' ? 'Calling…' : call.state === 'incoming' ? 'Incoming call' : `On call · ${since(call.since)}`}</span>
      <div className="call-buttons">
        {call.state === 'incoming' && (
          <button className="answer" onClick={phone.answer}>
            Answer
          </button>
        )}
        {call.state === 'on' && (
          <button className="talk" onClick={() => phone.view(call.id)}>
            Talk
          </button>
        )}
        <button className="hangup" onClick={phone.hangup}>
          {call.state === 'incoming' ? 'Decline' : 'Hang up'}
        </button>
      </div>
    </div>
  )
}

export default function Phone() {
  const view = useGame((s) => s.phoneView)
  const call = useGame((s) => s.call)
  const players = useGame((s) => s.players)
  const clock = useClock()
  const [hideCall, setHideCall] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' || (e.code === 'KeyP' && !(e.target instanceof HTMLInputElement))) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => setHideCall(false), [call?.state])
  const showCall = call && !(call.state === 'on' && (hideCall || view === call.id))
  return (
    <div className="panel-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="phone">
        <div className="phone-bar">
          <span>{clock}</span>
          <span>📶 {players > 1 ? `${players - 1} online` : ''}</span>
          <button className="ph-close" onClick={close} aria-label="Put the phone away">
            ✕
          </button>
        </div>
        {showCall ? (
          <>
            <CallScreen call={call} />
            {call.state === 'on' && (
              <button className="ph-link" onClick={() => setHideCall(true)}>
                Contacts
              </button>
            )}
          </>
        ) : view != null ? (
          <Thread id={view} />
        ) : (
          <>
            <h2 className="phone-title">Contacts</h2>
            <Contacts />
          </>
        )}
      </div>
    </div>
  )
}

// On the HUD while the phone is away: incoming calls, the call in progress,
// and texts as they arrive.
export function PhoneAlerts() {
  const call = useGame((s) => s.call)
  const toast = useGame((s) => s.phoneToast)
  const panel = useGame((s) => s.panel)
  if (panel === 'phone') return null
  return (
    <>
      {call?.state === 'incoming' && (
        <div className="call-alert">
          <span>📞 {call.name} is calling</span>
          <button className="answer" onClick={phone.answer}>
            Answer
          </button>
          <button className="hangup" onClick={phone.hangup}>
            Decline
          </button>
        </div>
      )}
      {call && call.state !== 'incoming' && (
        <div className="call-alert small">
          <span>{call.state === 'ringing' ? `📞 Calling ${call.name}…` : `📞 On call with ${call.name}`}</span>
          {call.state === 'on' && (
            <button className="talk" onClick={() => phone.open(call.id)}>
              Talk
            </button>
          )}
          <button className="hangup" onClick={phone.hangup}>
            End
          </button>
        </div>
      )}
      {toast && (
        <button className="phone-toast" key={toast.key} onClick={() => phone.open()}>
          {toast.text}
        </button>
      )}
    </>
  )
}
