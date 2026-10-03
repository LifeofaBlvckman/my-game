import { cleanDecor } from './decor'
import { useGame, world } from './state'
import { cleanOutfit } from './wardrobe'
import { cleanGarage, cleanProperties } from './property'

// Saved games. Signed in (name + PIN), the game saves to the server
// (server/saves.js) a few seconds after anything worth keeping changes, and
// when the tab closes. Everyone also gets a copy in this browser, so a guest
// (no PIN) keeps their progress on this device.

const SESSION_KEY = 'eko-streets-session' // { name, token }
const LOCAL_KEY = (name) => `eko-streets-save:${name.toLowerCase()}`
const AUTOSAVE_MS = 20000
const SOON_MS = 3000

const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key))
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private windows can refuse storage.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

async function api(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error("Can't reach the save server. Leave the PIN empty to play without saving online.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'The save server had a problem.'), { status: res.status })
  return data
}

// --- What a save holds ---

export function collectSave() {
  const g = useGame.getState()
  return {
    v: 1,
    money: g.money,
    health: g.health,
    // A job half done starts again from its first conversation.
    quest: g.quest,
    gender: g.gender,
    outfit: g.outfit,
    decor: g.decor,
    owned: g.owned,
    properties: g.properties,
    garage: g.garage,
    chopIndex: g.chopIndex,
    music: g.music,
    playSeconds: Math.round(world.playSeconds ?? 0),
  }
}

export function applySave(save) {
  if (!save || typeof save !== 'object') return
  const n = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d)
  useGame.setState({
    money: n(save.money, 0, 1e9, 2000),
    health: n(save.health, 1, 100, 100),
    quest: n(save.quest, 0, 100, 0),
    step: -1,
    gender: save.gender === 'girl' ? 'girl' : 'boy',
    outfit: cleanOutfit(save.outfit, save.gender),
    decor: cleanDecor(save.decor),
    owned: Array.isArray(save.owned) ? save.owned.filter((id) => typeof id === 'string').slice(0, 100) : [],
    properties: cleanProperties(save.properties),
    garage: cleanGarage(save.garage),
    chopIndex: n(save.chopIndex, 0, 1e6, 0),
    music: ['calm', 'afro', 'off'].includes(save.music) ? save.music : 'calm',
  })
  world.playSeconds = n(save.playSeconds, 0, 1e9, 0)
}

// --- Signing in ---

// With a PIN: sign in (or make the account). Without one: carry on with this
// browser's session for that name if there is one, else play as a guest.
// Resolves to { save, created, guest }.
export async function signIn(name, pin) {
  const session = storage.get(SESSION_KEY)
  if (!pin && session?.name?.toLowerCase() === name.toLowerCase()) {
    try {
      const data = await api('/api/resume', { token: session.token })
      useGame.setState({ account: { name: data.name, token: session.token } })
      return { save: data.save ?? storage.get(LOCAL_KEY(name)), guest: false }
    } catch (err) {
      if (err.status === 401) storage.remove(SESSION_KEY)
      // Offline or signed out: fall back to the copy in this browser.
    }
  }
  if (!pin) {
    useGame.setState({ account: null })
    return { save: storage.get(LOCAL_KEY(name)), guest: true }
  }
  const data = await api('/api/login', { name, pin })
  storage.set(SESSION_KEY, { name: data.name, token: data.token })
  useGame.setState({ account: { name: data.name, token: data.token } })
  // A brand new account starts from this browser's guest progress, if any.
  return { save: data.save ?? storage.get(LOCAL_KEY(name)), created: !!data.created, guest: false }
}

export const signedInName = () => storage.get(SESSION_KEY)?.name ?? null

export function signOut() {
  storage.remove(SESSION_KEY)
  useGame.setState({ account: null })
}

// --- Saving ---

let last = ''
let soon = null
let saving = false

export async function saveNow() {
  const g = useGame.getState()
  if (g.phase === 'title') return
  const save = collectSave()
  const text = JSON.stringify(save)
  storage.set(LOCAL_KEY(g.playerName || 'tunde'), save)
  if (!g.account || text === last || saving) return
  saving = true
  useGame.setState({ saveStatus: 'saving' })
  try {
    await api('/api/save', { token: g.account.token, save })
    last = text
    useGame.setState({ saveStatus: 'saved' })
  } catch (err) {
    useGame.setState({ saveStatus: 'offline' })
    if (err.status === 401) signOut()
  } finally {
    saving = false
  }
}

export function requestSave() {
  clearTimeout(soon)
  soon = setTimeout(saveNow, SOON_MS)
}

// Start autosaving once the game is running.
let started = false
export function startAutosave() {
  if (started) return
  started = true
  last = JSON.stringify(collectSave())
  setInterval(saveNow, AUTOSAVE_MS)
  // Save soon after anything that matters changes.
  useGame.subscribe((s, prev) => {
    if (s.phase === 'title') return
    if (s.quest !== prev.quest || s.outfit !== prev.outfit || s.decor !== prev.decor || s.owned !== prev.owned || s.money !== prev.money || s.properties !== prev.properties || s.garage !== prev.garage || s.chopIndex !== prev.chopIndex) requestSave()
  })
  // Closing the tab or switching away on a phone: save right away.
  const flush = () => {
    const g = useGame.getState()
    const save = collectSave()
    storage.set(LOCAL_KEY(g.playerName || 'tunde'), save)
    if (g.account && JSON.stringify(save) !== last) {
      navigator.sendBeacon?.('/api/save', new Blob([JSON.stringify({ token: g.account.token, save })], { type: 'application/json' }))
      last = JSON.stringify(save)
    }
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}
