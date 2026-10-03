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

// Illustrated face on a transparent background, so the head's own color
// shows through: almond eyes under a heavier upper lid, short brows, a hint of
// a nose and a small mouth.
export function drawFace(ctx, ox, oy, s, { female, beard, mouth = 'smile', brows }) {
  const X = (v) => ox + v * s
  const Y = (v) => oy + v * s
  const ink = '#1d1310'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (beard) {
    ctx.fillStyle = 'rgba(25, 12, 6, 0.45)'
    ctx.beginPath()
    ctx.moveTo(X(0.12), Y(0.62))
    ctx.quadraticCurveTo(X(0.5), Y(1.12), X(0.88), Y(0.62))
    ctx.quadraticCurveTo(X(0.5), Y(0.86), X(0.12), Y(0.62))
    ctx.fill()
    ctx.strokeStyle = 'rgba(25, 12, 6, 0.7)'
    ctx.lineWidth = s * 0.035
    ctx.beginPath()
    ctx.moveTo(X(0.4), Y(0.7))
    ctx.quadraticCurveTo(X(0.5), Y(0.67), X(0.6), Y(0.7))
    ctx.stroke()
  }

  for (const [cx, dir] of [[0.31, -1], [0.69, 1]]) {
    // Eye
    ctx.fillStyle = '#f4efe6'
    ctx.beginPath()
    ctx.ellipse(X(cx), Y(0.47), 0.085 * s, 0.045 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a1810'
    ctx.beginPath()
    ctx.ellipse(X(cx + dir * 0.005), Y(0.47), 0.045 * s, 0.05 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(X(cx + 0.015), Y(0.455), 0.012 * s, 0, Math.PI * 2)
    ctx.fill()
    // Upper lid, heavier toward the outside
    ctx.strokeStyle = ink
    ctx.lineWidth = s * (female ? 0.04 : 0.032)
    ctx.beginPath()
    ctx.moveTo(X(cx - dir * 0.09), Y(0.47))
    ctx.quadraticCurveTo(X(cx), Y(0.405), X(cx + dir * 0.1), Y(female ? 0.43 : 0.45))
    ctx.stroke()
    // Brow
    ctx.lineWidth = s * (brows ? 0.045 : female ? 0.022 : 0.032)
    ctx.beginPath()
    ctx.moveTo(X(cx - dir * 0.08), Y(brows ? 0.35 : 0.34))
    ctx.quadraticCurveTo(X(cx), Y(female ? 0.3 : 0.32), X(cx + dir * 0.09), Y(brows ? 0.33 : 0.35))
    ctx.stroke()
  }

  // Nose: just a soft shadow line
  ctx.strokeStyle = 'rgba(40, 18, 10, 0.4)'
  ctx.lineWidth = s * 0.03
  ctx.beginPath()
  ctx.moveTo(X(0.47), Y(0.62))
  ctx.quadraticCurveTo(X(0.5), Y(0.66), X(0.54), Y(0.62))
  ctx.stroke()

  // Mouth
  ctx.strokeStyle = female ? '#7a2a30' : 'rgba(45, 20, 14, 0.85)'
  ctx.lineWidth = s * (female ? 0.045 : 0.03)
  ctx.beginPath()
  if (mouth === 'grin') {
    ctx.moveTo(X(0.42), Y(0.76))
    ctx.quadraticCurveTo(X(0.5), Y(0.82), X(0.58), Y(0.76))
  } else if (mouth === 'flat') {
    ctx.moveTo(X(0.44), Y(0.78))
    ctx.lineTo(X(0.56), Y(0.78))
  } else {
    ctx.moveTo(X(0.43), Y(0.77))
    ctx.quadraticCurveTo(X(0.5), Y(0.8), X(0.57), Y(0.77))
  }
  ctx.stroke()
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
