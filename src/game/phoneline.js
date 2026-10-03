import { ringTone, textTone } from './audio'
import { mapSpot } from './rooms'
import { useGame, world } from './state'

// Tunde's phone: text, call or send your location to anyone online, in any
// room. The server just passes messages along (server/multiplayer.js). A
// "call" is a live line: while it's on, what you both type shows up on
// screen as you say it.

const RING_FOR = 25000 // ms before an unanswered call gives up
const PIN_FOR = 3 * 60 * 1000
let ringTimer = null
let giveUp = null
let toastKey = 0

const toast = (text) => {
  const key = ++toastKey
  useGame.setState({ phoneToast: { text, key } })
  setTimeout(() => useGame.getState().phoneToast?.key === key && useGame.setState({ phoneToast: null }), 4500)
}

function ringing(on) {
  clearInterval(ringTimer)
  ringTimer = null
  if (on) {
    ringTone()
    ringTimer = setInterval(ringTone, 2200)
  }
}

function addToThread(id, name, entry) {
  const threads = useGame.getState().threads
  const thread = threads[id] ?? { name, msgs: [] }
  useGame.setState({ threads: { ...threads, [id]: { name, msgs: [...thread.msgs, { ...entry, at: Date.now() }].slice(-60) } } })
}

const openOn = () => {
  const g = useGame.getState()
  return g.panel === 'phone' ? g.phoneView : null
}

// Messages from the server.
export function phoneMessage(msg) {
  const g = useGame.getState()
  if (msg.t === 'roster') return useGame.setState({ contacts: msg.players })
  if (msg.t === 'dm') {
    const onCall = g.call?.state === 'on' && g.call.id === msg.from
    addToThread(msg.from, msg.name, { me: false, text: msg.text })
    if (onCall) useGame.setState({ subtitle: { speaker: msg.name, text: msg.text } })
    if (openOn() !== msg.from) {
      useGame.setState({ unread: useGame.getState().unread + 1 })
      if (!onCall) toast(`📱 ${msg.name}: ${msg.text}`)
    }
    textTone()
  } else if (msg.t === 'ring') {
    // Already on the phone: they get a busy line.
    if (g.call) return world.net?.send({ t: 'hangup', to: msg.from })
    useGame.setState({ call: { id: msg.from, name: msg.name, state: 'incoming' } })
    ringing(true)
  } else if (msg.t === 'answer' && g.call?.id === msg.from && g.call.state === 'ringing') {
    clearTimeout(giveUp)
    ringing(false)
    useGame.setState({ call: { ...g.call, state: 'on', since: Date.now() } })
    addToThread(msg.from, msg.name, { system: true, text: 'Call started' })
  } else if (msg.t === 'hangup' && g.call?.id === msg.from) {
    clearTimeout(giveUp)
    ringing(false)
    const was = g.call.state
    useGame.setState({ call: null })
    toast(was === 'ringing' ? `📞 ${msg.name} can't talk right now` : `📞 Call with ${msg.name} ended`)
    if (was === 'incoming') addToThread(msg.from, msg.name, { system: true, text: 'Missed call' })
  } else if (msg.t === 'pin') {
    const spot = mapSpot(msg.x, msg.z)
    world.pin = { x: spot.x, z: spot.z, name: msg.name, until: performance.now() + PIN_FOR }
    addToThread(msg.from, msg.name, { me: false, system: true, text: '📍 Shared their location (pink square on your map)' })
    toast(`📍 ${msg.name} sent their location: the flashing pink square on your map`)
    textTone()
  }
}

export const phone = {
  open(view = null) {
    useGame.setState({ panel: 'phone', phoneView: view })
    world.net?.send({ t: 'roster' })
    if (view != null) phone.read()
  },
  view(id) {
    useGame.setState({ phoneView: id })
    phone.read()
  },
  read() {
    useGame.setState({ unread: 0 })
  },
  text(id, name, text) {
    text = text.trim().slice(0, 200)
    if (!text || !world.net) return
    world.net.send({ t: 'dm', to: id, text })
    addToThread(id, name, { me: true, text })
    const call = useGame.getState().call
    if (call?.state === 'on' && call.id === id) useGame.setState({ subtitle: { speaker: 'You', text } })
  },
  call(id, name) {
    if (!world.net || useGame.getState().call) return
    world.net.send({ t: 'ring', to: id })
    useGame.setState({ call: { id, name, state: 'ringing' } })
    ringing(true)
    giveUp = setTimeout(() => {
      if (useGame.getState().call?.state !== 'ringing') return
      phone.hangup()
      toast(`📞 ${name} didn't pick up`)
    }, RING_FOR)
  },
  answer() {
    const call = useGame.getState().call
    if (call?.state !== 'incoming') return
    ringing(false)
    world.net?.send({ t: 'answer', to: call.id })
    useGame.setState({ call: { ...call, state: 'on', since: Date.now() } })
    addToThread(call.id, call.name, { system: true, text: 'Call started' })
    phone.open(call.id)
  },
  hangup() {
    const call = useGame.getState().call
    if (!call) return
    clearTimeout(giveUp)
    ringing(false)
    world.net?.send({ t: 'hangup', to: call.id })
    useGame.setState({ call: null })
  },
  pin(id, name) {
    world.net?.send({ t: 'pin', to: id })
    addToThread(id, name, { me: true, system: true, text: '📍 You shared your location' })
  },
}
