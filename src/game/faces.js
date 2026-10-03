import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

// Hand-drawn cartoon faces. Everything is generated on a canvas at startup, so
// there are no image files to manage yet. Swap in painted textures later.

export const SKINS = ['#5a3624', '#6e4430', '#87573a', '#a06a45']
export const FACE_COLS = 4
export const FACE_COUNT = 16
const PX = 128

// Face options are derived from the index so NPC looks are deterministic.
export function faceStyle(index) {
  return {
    skin: SKINS[index % 4],
    female: index >= 8,
    beard: index < 8 && index % 3 === 1,
    mouth: ['smile', 'grin', 'smile', 'flat'][index % 4],
    brows: index % 4 === 1 || index % 4 === 3,
  }
}

// Cartoon face on a transparent background: dot eyes with a highlight, rosy
// cheeks and a small mouth. The head's own color shows through.
export function drawFace(ctx, ox, oy, s, { female, beard, mouth = 'smile', brows }) {
  const X = (v) => ox + v * s
  const Y = (v) => oy + v * s
  const ellipse = (x, y, rx, ry, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(X(x), Y(y), rx * s, ry * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.lineCap = 'round'

  if (beard) {
    ctx.fillStyle = 'rgba(25, 12, 6, 0.6)'
    ctx.beginPath()
    ctx.ellipse(X(0.5), Y(0.78), 0.3 * s, 0.2 * s, 0, 0, Math.PI)
    ctx.fill()
    ellipse(0.5, 0.66, 0.12, 0.035, 'rgba(25, 12, 6, 0.75)')
  }
  // Rosy cheeks
  ellipse(0.24, 0.62, 0.08, 0.05, 'rgba(235, 100, 110, 0.35)')
  ellipse(0.76, 0.62, 0.08, 0.05, 'rgba(235, 100, 110, 0.35)')
  // Eyes
  ellipse(0.34, 0.46, 0.065, 0.085, '#1b100c')
  ellipse(0.66, 0.46, 0.065, 0.085, '#1b100c')
  ellipse(0.355, 0.43, 0.022, 0.022, '#ffffff')
  ellipse(0.675, 0.43, 0.022, 0.022, '#ffffff')
  ctx.strokeStyle = '#1b100c'
  ctx.lineWidth = Math.max(1, s * 0.035)
  if (female) {
    // Lashes
    for (const [x, d] of [[0.27, -1], [0.73, 1]]) {
      ctx.beginPath()
      ctx.moveTo(X(x), Y(0.41))
      ctx.lineTo(X(x + d * 0.05), Y(0.36))
      ctx.stroke()
    }
  }
  if (brows) {
    ctx.lineWidth = Math.max(1, s * 0.04)
    for (const [x0, y0, x1, y1] of [[0.27, 0.32, 0.41, 0.3], [0.59, 0.3, 0.73, 0.32]]) {
      ctx.beginPath()
      ctx.moveTo(X(x0), Y(y0))
      ctx.lineTo(X(x1), Y(y1))
      ctx.stroke()
    }
  }
  // Mouth
  const lips = female ? '#a8323f' : '#4a2018'
  ctx.strokeStyle = lips
  ctx.fillStyle = lips
  ctx.lineWidth = Math.max(1, s * 0.04)
  ctx.beginPath()
  if (mouth === 'grin') {
    ctx.moveTo(X(0.4), Y(0.66))
    ctx.quadraticCurveTo(X(0.5), Y(0.8), X(0.6), Y(0.66))
    ctx.closePath()
    ctx.fill()
  } else if (mouth === 'flat') {
    ctx.moveTo(X(0.44), Y(0.7))
    ctx.lineTo(X(0.56), Y(0.7))
    ctx.stroke()
  } else {
    ctx.moveTo(X(0.42), Y(0.67))
    ctx.quadraticCurveTo(X(0.5), Y(0.75), X(0.58), Y(0.67))
    ctx.stroke()
  }
}

function finish(canvas) {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
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
