import { CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace } from 'three'

// Hand-drawn pixel faces. Everything is generated on a canvas at startup, so
// there are no image files to manage yet. Swap in painted textures later.

export const SKINS = ['#3b2417', '#4f2f1c', '#663e26', '#86573a']
export const FACE_COLS = 4
export const FACE_COUNT = 16
const PX = 64

const darken = (hex, f) => {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
}

// Face options are derived from the index so NPC looks are deterministic.
export function faceStyle(index) {
  return {
    skin: SKINS[index % 4],
    female: index >= 8,
    beard: index < 8 && index % 3 === 1,
    smile: index % 2 === 0,
  }
}

export function drawFace(ctx, ox, oy, s, { skin, female, beard, smile }) {
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c
    ctx.fillRect(ox + x * s, oy + y * s, Math.max(1, w * s), Math.max(1, h * s))
  }
  r(0, 0, 1, 1, skin)
  // Eyebrows
  r(0.17, 0.3, 0.24, 0.05, '#120a06')
  r(0.59, 0.3, 0.24, 0.05, '#120a06')
  // Eyes
  r(0.18, 0.39, 0.22, 0.1, '#f1ece2')
  r(0.6, 0.39, 0.22, 0.1, '#f1ece2')
  r(0.25, 0.39, 0.09, 0.1, '#1a0f08')
  r(0.67, 0.39, 0.09, 0.1, '#1a0f08')
  if (female) {
    r(0.16, 0.36, 0.26, 0.04, '#0a0604')
    r(0.58, 0.36, 0.26, 0.04, '#0a0604')
  }
  // Nose
  r(0.42, 0.5, 0.16, 0.14, darken(skin, 0.8))
  r(0.4, 0.61, 0.07, 0.04, darken(skin, 0.5))
  r(0.53, 0.61, 0.07, 0.04, darken(skin, 0.5))
  // Mouth
  const lips = female ? '#7a2434' : darken(skin, 0.65)
  r(0.33, 0.74, 0.34, 0.08, lips)
  if (smile) {
    r(0.3, 0.71, 0.05, 0.05, lips)
    r(0.65, 0.71, 0.05, 0.05, lips)
    r(0.37, 0.75, 0.26, 0.03, '#efe9df')
  }
  if (beard) {
    r(0.3, 0.68, 0.4, 0.05, '#120a06')
    r(0.18, 0.82, 0.64, 0.18, '#120a06')
    r(0.33, 0.74, 0.34, 0.08, lips)
  }
}

function finish(canvas) {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = NearestFilter
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  return tex
}

let atlas
export function getFaceAtlas() {
  if (atlas) return atlas
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = PX * FACE_COLS
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < FACE_COUNT; i++) {
    drawFace(ctx, (i % FACE_COLS) * PX, Math.floor(i / FACE_COLS) * PX, PX, faceStyle(i))
  }
  atlas = finish(canvas)
  return atlas
}

export function makeFaceTexture(style) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = PX
  drawFace(canvas.getContext('2d'), 0, 0, PX, style)
  return finish(canvas)
}

// Ankara-style wax print, used for the player's shirt.
export function makeAnkaraTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#e07b1a'
  ctx.fillRect(0, 0, 32, 32)
  const ring = (x, y, colors) =>
    colors.forEach((c, k) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x, y, 7 - k * 2.3, 0, Math.PI * 2)
      ctx.fill()
    })
  ring(8, 8, ['#1b3f8f', '#f4d03f', '#9b1d20'])
  ring(24, 24, ['#1b3f8f', '#f4d03f', '#9b1d20'])
  ring(24, 8, ['#2e7d32', '#f5f0e1', '#1b3f8f'])
  ring(8, 24, ['#2e7d32', '#f5f0e1', '#1b3f8f'])
  return finish(canvas)
}

// Text on a board, for signs and billboards.
export function makeSignTexture(text, { bg = '#111', fg = '#fff', w = 512, h = 128, font = 'bold 64px Arial Black, Impact, sans-serif', border, glow } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = h * 0.08
    ctx.strokeRect(0, 0, w, h)
  }
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = text.split('\n')
  let size = parseInt(font.match(/(\d+)px/)[1], 10)
  // Shrink to fit the widest line.
  while (size > 10 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > w * 0.9) {
    size -= 2
    ctx.font = font.replace(/\d+px/, `${size}px`)
  }
  if (glow) {
    ctx.shadowColor = glow
    ctx.shadowBlur = h * 0.15
  }
  ctx.fillStyle = fg
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1))
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
