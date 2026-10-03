import { CanvasTexture, SRGBColorSpace } from 'three'
import { world } from './state'

// Emoji reactions, Messenger-style: press 1-8 (or the emoji button on a phone)
// and a bubble pops up over your head for everyone online to see.
export const EMOTES = ['👋', '😂', '❤️', '😮', '😡', '🔥', '🙏', '👍']
export const EMOTE_TIME = 3 // seconds a bubble stays up

export function emote(index) {
  if (!(index >= 0 && index < EMOTES.length)) return
  const now = performance.now()
  if (now - (world.emote?.at ?? 0) < 400) return
  world.emote = { e: index, at: now }
  world.net?.emote(index)
}

const textures = new Map()
// A white speech bubble with an ink outline and the emoji inside.
export function emoteTexture(index) {
  if (textures.has(index)) return textures.get(index)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#1d1a24'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.roundRect(10, 8, 108, 92, 30)
  ctx.moveTo(52, 98)
  ctx.lineTo(64, 120)
  ctx.lineTo(76, 98)
  ctx.fill()
  ctx.stroke()
  // Cover the seam between the bubble and its tail.
  ctx.fillRect(54, 92, 20, 8)
  ctx.font = '60px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(EMOTES[index], 64, 56)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  textures.set(index, tex)
  return tex
}
