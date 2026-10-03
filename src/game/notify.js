import { useGame } from './state'

// On-screen notes for the game's smaller systems (area boys, the barracks,
// shops). GameLogic has its own; these keys start high so the two never mix
// up whose note a timeout is clearing.
let key = 1e7

export const naira = (n) => `₦${n.toLocaleString()}`

export function message(text, color = '#ffd23a', ms = 3500) {
  const k = ++key
  useGame.setState({ message: { text, color, key: k } })
  setTimeout(() => useGame.getState().message?.key === k && useGame.setState({ message: null }), ms)
}

export function banner(text) {
  useGame.setState({ banner: { text, key: ++key } })
}

// A line of speech at the bottom of the screen.
export function say(speaker, text, ms = 2800) {
  const k = ++key
  useGame.setState({ subtitle: { speaker, text, key: k } })
  setTimeout(() => useGame.getState().subtitle?.key === k && useGame.setState({ subtitle: null }), ms)
}
